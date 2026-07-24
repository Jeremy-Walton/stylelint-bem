import stylelint from 'stylelint';
import type { Root, Rule } from 'postcss';
import parser from 'postcss-selector-parser';
import type { BemNaming, BemSegment, ParsedBemClassName } from '../../utils/bem-parser.js';
import { bemBaseOptionsSchema, isString } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import type { ClassNode } from '../../utils/selector-walker.js';
import { createBemRule, forEachBemClass, reportBemViolation } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

type RequireNestingMode = 'strict' | 'weak';

const ruleName = 'stylelint-bem/require-nesting';

const messages = stylelint.utils.ruleMessages(ruleName, {
  elementNotFullSelector: (className: string) =>
    `Expected element ".${className}" to be its own full selector, not compounded with another selector`,
  elementCompoundedLikeModifier: (className: string, modifierSuggestion: string) =>
    `Expected element ".${className}" not to be compounded with '&' — that's the modifier shape. Either name it ".${modifierSuggestion}" (a modifier) or nest it as its own full selector (an element)`,
  elementNotNested: (className: string, blockName: string) =>
    `Expected element ".${className}" to be nested (at any depth) inside its block ".${blockName}" via native CSS nesting`,
  elementNotNestedAnywhere: (className: string, blockName: string) =>
    `Expected element ".${className}" to be nested inside a rule via native CSS nesting (e.g. inside its block ".${blockName}")`,
  modifierNotCompound: (className: string, targetName: string) =>
    `Expected modifier ".${className}" to be compounded with '&' (e.g. "&.${className}") or with its target (e.g. ".${targetName}.${className}")`,
  modifierNotNestedDirectly: (className: string, targetName: string) =>
    `Expected modifier ".${className}" to be nested directly inside ".${targetName}" via native CSS nesting`,
});

// A chain is nesting-equivalent when its root is `&` (real ancestor validated elsewhere),
// classless (no BEM identity to conflict with, e.g. `summary .block__el`), or shares the class's
// own block (e.g. `.block .block__el`, two elements of one block nested for DOM reasons). An
// unrelated root (`.wrapper .card__title`) is none of these and falls through to false.
function isLegitimateChain(classNode: ClassNode, ownBlock: string, naming: BemNaming): boolean {
  const root = classNode.chainRoot;
  if (!root) return false;
  if (root.kind !== 'classes') return true;

  return root.names.some((rootClassName) => naming.blockOf(rootClassName) === ownBlock);
}

// True when a rule's selector(s) carry no class at all (only tag/id/pseudo) — pure DOM structure,
// e.g. `td`, `td:first-child`.
function isClasslessRule(ruleNode: Rule): boolean {
  return ruleNode.selectors.every((selector) => getClassNodes(selector).length === 0);
}

// At-rules (@media, @supports, ...) are transparent — skipped without counting as a nesting level.
function findAncestorRules(node: Rule): Rule[] {
  const rules: Rule[] = [];
  let current = node.parent;

  while (current && current.type !== 'root') {
    if (current.type === 'rule') rules.push(current as Rule);
    current = current.parent;
  }

  return rules;
}

// `&` compounded on a classless ancestor (e.g. `td { &.block__el {} }`) resolves to something
// carrying no class — equivalent to writing the class bare and tag-tolerant, unlike `&` on a real,
// class-bearing ancestor (`.block { &.block__el {} }`), which conflates block and element identity.
function isAmpersandOnClasslessAncestor(ruleNode: Rule): boolean {
  const nearestAncestor = findAncestorRules(ruleNode)[0];
  return nearestAncestor !== undefined && isClasslessRule(nearestAncestor);
}

// A rule "defines" a class when its selector targets exactly that class: bare, class-compounded,
// via a legitimate chain, or ampersand-compounded on a classless ancestor — in every case,
// anything nested inside can only ever match elements carrying the class.
function ruleDefinesClass(ruleNode: Rule, className: string, naming: BemNaming): boolean {
  return ruleNode.selectors.some((selector) =>
    getClassNodes(selector).some(
      (node) =>
        node.name === className &&
        !isInsideNonSubjectPseudo(node) &&
        (node.nestingShape === 'bare' ||
          node.nestingShape === 'class-compound' ||
          isLegitimateChain(node, naming.blockOf(node.name), naming) ||
          (node.nestingShape === 'ampersand' && isAmpersandOnClasslessAncestor(ruleNode))),
    ),
  );
}

// A rule whose entire selector is `&` compounded with modifier(s) of targetName, e.g.
// `&.block--mod` or `&.block--mod1.block--mod2` — stacking these is equivalent to writing every
// modifier in one compound directly under targetName, so isDirectlyNestedUnderTarget can pass
// straight through any number of them.
function isPureAmpersandModifierCompoundOf(
  ruleNode: Rule,
  targetName: string,
  naming: BemNaming,
): boolean {
  return ruleNode.selectors.every((selector) => {
    const nodes = getClassNodes(selector);
    return (
      nodes.length > 0 &&
      nodes.every(
        (node) => node.nestingShape === 'ampersand' && naming.isModifierOf(node.name, targetName),
      )
    );
  });
}

// True when a selector is only the nesting selector `&`, optionally compounded with pseudo-classes
// (e.g. `&:has(.other)`, `&:hover`) — the subject is still whatever `&` resolves to, so this is
// transparent for nesting purposes the same way `@media` is.
function isPureAmpersandPseudoSelector(selector: string): boolean {
  let result = false;

  parser((root) => {
    const first = root.first;
    if (!first) return;

    const nodes = first.nodes;
    if (nodes.length === 0 || nodes.some((node) => node.type === 'combinator')) return;

    result =
      nodes.some((node) => node.type === 'nesting') &&
      nodes.every((node) => node.type === 'nesting' || node.type === 'pseudo');
  }).processSync(selector);

  return result;
}

// A modifier must be nested directly under the rule defining its target, tolerating any number of
// ancestors that don't change what `&` resolves to: a pure ampersand-modifier compound of the same
// target, or a pure ampersand-plus-pseudo selector (e.g. `&:hover`). The first ancestor that's
// neither ends the search.
function isDirectlyNestedUnderTarget(
  ancestorRules: Rule[],
  targetName: string,
  naming: BemNaming,
): boolean {
  for (const ancestor of ancestorRules) {
    if (ruleDefinesClass(ancestor, targetName, naming)) return true;
    if (isPureAmpersandModifierCompoundOf(ancestor, targetName, naming)) continue;
    if (ancestor.selectors.every(isPureAmpersandPseudoSelector)) continue;
    return false;
  }

  return false;
}

// The target's exact name as a compound sibling is a direct pairing regardless of whether the
// compound also carries `&` — both classes land on the same node either way.
function isCompoundedWith(classNode: ClassNode, className: string): boolean {
  return (classNode.compoundClassNames ?? []).includes(className);
}

// Two+ modifiers of the same block compounded with `&` (e.g. `&.block--mod1.block--mod2`) are
// peers, not parent/child — legitimate as long as every sibling shares the class's own block.
function isSameBlockCompound(classNode: ClassNode, ownBlock: string, naming: BemNaming): boolean {
  return (classNode.compoundClassNames ?? []).every(
    (name) => naming.blockOf(name) === ownBlock,
  );
}

// Pseudo-classes whose arguments only filter the subject, never the element being styled —
// :is()/:where() excluded on purpose since their arguments form the subject itself.
const NON_SUBJECT_PSEUDOS = new Set([':has', ':not', ':nth-child', ':nth-last-child']);

function isInsideNonSubjectPseudo(classNode: ClassNode): boolean {
  return (
    classNode.enclosingPseudos?.some((pseudo) => NON_SUBJECT_PSEUDOS.has(pseudo.toLowerCase())) ?? false
  );
}

// Everything the orchestration layer needs for one BEM class under inspection — built once per
// class in checkRequireNesting and threaded through the element/modifier checks.
interface NestingCheck {
  ruleNode: Rule;
  classNode: ClassNode;
  parsed: ParsedBemClassName;
  finalSegment: BemSegment;
  expectedParentName: string;
  ancestorRules: Rule[];
  context: RuleContext;
  mode: RequireNestingMode;
}

function checkModifierNesting(check: NestingCheck): void {
  const { ruleNode, classNode, parsed, expectedParentName, ancestorRules, context } = check;

  // Compounding a modifier directly with its target pairs the two in the selector itself —
  // equivalent to nesting &.block--mod inside it.
  if (isCompoundedWith(classNode, expectedParentName)) return;

  if (
    classNode.nestingShape !== 'ampersand' ||
    !isSameBlockCompound(classNode, parsed.block, context.naming)
  ) {
    reportBemViolation(
      context,
      ruleNode,
      classNode,
      messages.modifierNotCompound,
      classNode.name,
      expectedParentName,
    );
    return;
  }

  if (!isDirectlyNestedUnderTarget(ancestorRules, expectedParentName, context.naming)) {
    reportBemViolation(
      context,
      ruleNode,
      classNode,
      messages.modifierNotNestedDirectly,
      classNode.name,
      expectedParentName,
    );
  }
}

// An element's selector is a valid definition when it's bare, or `&` resolving to a classless
// ancestor (tag-tolerant, no real element identity), or a class-compound / legitimate chain — in
// those last two only when every compounded sibling is one of the element's own modifiers (the
// modifier check covers those siblings; the element itself still needs nesting, checked separately).
function isValidElementShape(check: NestingCheck): boolean {
  const { ruleNode, classNode, parsed, context } = check;

  const isCompoundedWithOwnModifiers = (classNode.compoundClassNames ?? []).every((name) =>
    context.naming.isModifierOf(name, classNode.name),
  );

  const isElementAmpersandOnClasslessAncestor =
    classNode.nestingShape === 'ampersand' &&
    isCompoundedWithOwnModifiers &&
    isAmpersandOnClasslessAncestor(ruleNode);

  return (
    classNode.nestingShape === 'bare' ||
    isElementAmpersandOnClasslessAncestor ||
    ((classNode.nestingShape === 'class-compound' ||
      isLegitimateChain(classNode, parsed.block, context.naming)) &&
      isCompoundedWithOwnModifiers)
  );
}

// Report the most specific message for an element whose shape isn't a valid definition: the
// modifier-lookalike `&.block__el`, the compounded-but-not-a-full-selector case, or the generic
// flat/misnested element (wording depends on mode).
function reportInvalidElementShape(check: NestingCheck): void {
  const { ruleNode, classNode, parsed, finalSegment, expectedParentName, context, mode } = check;

  // `&.block__el` alone is shape-for-shape identical to a valid modifier compound
  // (`&.block--mod`) — worth its own message since it's a common naming/shape mixup, rather
  // than the generic "not its own full selector" message below.
  const isSingleAmpersandCompound = classNode.nestingShape === 'ampersand' && !classNode.compoundClassNames;

  if (isSingleAmpersandCompound) {
    const modifierSuggestion = context.naming.format(parsed.block, [
      { separator: 'modifier', name: finalSegment.name },
    ]);
    reportBemViolation(
      context,
      ruleNode,
      classNode,
      messages.elementCompoundedLikeModifier,
      classNode.name,
      modifierSuggestion,
    );
  } else if (classNode.nestingShape === 'ampersand' || classNode.nestingShape === 'class-compound') {
    reportBemViolation(context, ruleNode, classNode, messages.elementNotFullSelector, classNode.name);
  } else {
    reportBemViolation(
      context,
      ruleNode,
      classNode,
      mode === 'weak' ? messages.elementNotNestedAnywhere : messages.elementNotNested,
      classNode.name,
      expectedParentName,
    );
  }
}

function checkElementNesting(check: NestingCheck): void {
  const { ruleNode, classNode, expectedParentName, ancestorRules, context, mode } = check;

  if (!isValidElementShape(check)) {
    reportInvalidElementShape(check);
    return;
  }

  // A chain rooted in literal classes (already validated upstream to share the element's block) is
  // self-sufficient — equivalent to real nesting even with zero ancestors. An ampersand root still
  // needs a real ancestor (`&` has no meaning without one); a classless root proves nothing about
  // the element's block — both still need the ancestor search below.
  const isSelfContainedChain = classNode.chainRoot?.kind === 'classes';

  // Strict requires nesting inside the element's own block; weak accepts nesting under any
  // component's rule (deliberate scoping) but never a flat element.
  if (mode === 'weak') {
    if (ancestorRules.length === 0 && !isSelfContainedChain) {
      reportBemViolation(context, ruleNode, classNode, messages.elementNotNestedAnywhere, classNode.name, expectedParentName);
    }
    return;
  }

  const isNested =
    isSelfContainedChain ||
    ancestorRules.some((ancestor) => ruleDefinesClass(ancestor, expectedParentName, context.naming));

  if (!isNested) {
    reportBemViolation(context, ruleNode, classNode, messages.elementNotNested, classNode.name, expectedParentName);
  }
}

function checkRequireNesting(root: Root, context: RuleContext, mode: RequireNestingMode): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    if (isInsideNonSubjectPseudo(classNode)) return;

    const finalSegment = context.naming.lastSegment(parsed)!;
    const check: NestingCheck = {
      ruleNode,
      classNode,
      parsed,
      finalSegment,
      expectedParentName: context.naming.parentClassName(parsed),
      ancestorRules: findAncestorRules(ruleNode),
      context,
      mode,
    };

    if (finalSegment.separator === 'modifier') {
      checkModifierNesting(check);
    } else {
      checkElementNesting(check);
    }
  });
}

function isRequireNestingPrimary(value: unknown): value is true | RequireNestingMode {
  return value === true || (isString(value) && (value === 'strict' || value === 'weak'));
}

function resolveRequireNestingMode(primary: true | RequireNestingMode): RequireNestingMode {
  return primary === 'weak' ? 'weak' : 'strict';
}

const rule = createBemRule<true | RequireNestingMode, BemBaseOptions>({
  ruleName,
  messages,
  possiblePrimary: [isRequireNestingPrimary],
  secondarySchema: bemBaseOptionsSchema,
  check: (root, context, primary) => checkRequireNesting(root, context, resolveRequireNestingMode(primary)),
});

export default stylelint.createPlugin(ruleName, rule);
export { isPureAmpersandPseudoSelector, messages, ruleName };

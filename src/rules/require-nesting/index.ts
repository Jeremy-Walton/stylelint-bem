import stylelint from 'stylelint';
import type { Root, Rule } from 'postcss';
import { formatClassName, lastSegment, parentClassName, parseClassName } from '../../utils/bem-parser.js';
import type { BemSeparatorOptions } from '../../utils/bem-parser.js';
import { findAncestorRules } from '../../utils/rule-ancestors.js';
import { bemBaseOptionsSchema, isString, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { getClassNodes, isPureAmpersandPseudoSelector } from '../../utils/selector-walker.js';
import type { ClassNode } from '../../utils/selector-walker.js';
import { forEachBemClass, reportBemViolation, validateBemOptions } from '../shared/rule-context.js';
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

// Well-defined even for non-BEM names — parseClassName treats the whole name as the block then.
function blockOf(className: string, separatorOptions: BemSeparatorOptions): string {
  return parseClassName(className, separatorOptions).block;
}

// A chain is nesting-equivalent when its root is `&` (real ancestor validated elsewhere),
// classless (no BEM identity to conflict with, e.g. `summary .block__el`), or shares the class's
// own block (e.g. `.block .block__el`, two elements of one block nested for DOM reasons). An
// unrelated root (`.wrapper .card__title`) is none of these and falls through to false.
function isLegitimateChain(classNode: ClassNode, separatorOptions: BemSeparatorOptions): boolean {
  if (classNode.nestingShape !== 'chained') return false;
  if (classNode.chainRootHasAmpersand) return true;

  const rootClassNames = classNode.chainRootClassNames ?? [];
  if (rootClassNames.length === 0) return true;

  const ownBlock = blockOf(classNode.name, separatorOptions);
  return rootClassNames.some((rootClassName) => blockOf(rootClassName, separatorOptions) === ownBlock);
}

// True when a rule's selector(s) carry no class at all (only tag/id/pseudo) — pure DOM structure,
// e.g. `td`, `td:first-child`.
function isClasslessRule(ruleNode: Rule): boolean {
  return ruleNode.selectors.every((selector) => getClassNodes(selector).length === 0);
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
function ruleDefinesClass(ruleNode: Rule, className: string, separatorOptions: BemSeparatorOptions): boolean {
  return ruleNode.selectors.some((selector) =>
    getClassNodes(selector).some(
      (node) =>
        node.name === className &&
        !isInsideNonSubjectPseudo(node) &&
        (node.nestingShape === 'bare' ||
          node.nestingShape === 'class-compound' ||
          isLegitimateChain(node, separatorOptions) ||
          (node.nestingShape === 'ampersand' && isAmpersandOnClasslessAncestor(ruleNode))),
    ),
  );
}

// True when className is itself a modifier of targetName, e.g. "block--mod" of "block", or
// "block__el--mod" of "block__el".
function isModifierOfTarget(className: string, targetName: string, separatorOptions: BemSeparatorOptions): boolean {
  const parsed = parseClassName(className, separatorOptions);
  const finalSegment = lastSegment(parsed);
  if (!finalSegment || finalSegment.separator !== 'modifier') return false;

  return parentClassName(parsed, separatorOptions) === targetName;
}

// A rule whose entire selector is `&` compounded with modifier(s) of targetName, e.g.
// `&.block--mod` or `&.block--mod1.block--mod2` — stacking these is equivalent to writing every
// modifier in one compound directly under targetName, so isDirectlyNestedUnderTarget can pass
// straight through any number of them.
function isPureAmpersandModifierCompoundOf(
  ruleNode: Rule,
  targetName: string,
  separatorOptions: BemSeparatorOptions,
): boolean {
  return ruleNode.selectors.every((selector) => {
    const nodes = getClassNodes(selector);
    return (
      nodes.length > 0 &&
      nodes.every(
        (node) => node.nestingShape === 'ampersand' && isModifierOfTarget(node.name, targetName, separatorOptions),
      )
    );
  });
}

// A modifier must be nested directly under the rule defining its target, tolerating any number of
// ancestors that don't change what `&` resolves to: a pure ampersand-modifier compound of the same
// target, or a pure ampersand-plus-pseudo selector (e.g. `&:hover`). The first ancestor that's
// neither ends the search.
function isDirectlyNestedUnderTarget(
  ancestorRules: Rule[],
  targetName: string,
  separatorOptions: BemSeparatorOptions,
): boolean {
  for (const ancestor of ancestorRules) {
    if (ruleDefinesClass(ancestor, targetName, separatorOptions)) return true;
    if (isPureAmpersandModifierCompoundOf(ancestor, targetName, separatorOptions)) continue;
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
function isSameBlockCompound(classNode: ClassNode, separatorOptions: BemSeparatorOptions): boolean {
  const ownBlock = blockOf(classNode.name, separatorOptions);
  return (classNode.compoundClassNames ?? []).every(
    (name) => blockOf(name, separatorOptions) === ownBlock,
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

function checkRequireNesting(root: Root, context: RuleContext, mode: RequireNestingMode): void {
  forEachBemClass(root, context, (ruleNode, classNode, parsed) => {
    if (isInsideNonSubjectPseudo(classNode)) return;

    const ancestorRules = findAncestorRules(ruleNode);
    const finalSegment = lastSegment(parsed)!;
    const expectedParentName = parentClassName(parsed, context.separatorOptions);

    if (finalSegment.separator === 'modifier') {
      // Compounding a modifier directly with its target pairs the two in the selector itself —
      // equivalent to nesting &.block--mod inside it.
      if (isCompoundedWith(classNode, expectedParentName)) return;

      // Weak mode leaves an ancestor-less modifier unchecked — typically a page file adding a
      // modifier onto a block defined (and nested) elsewhere, which strict mode could never satisfy.
      if (mode === 'weak' && ancestorRules.length === 0) return;

      if (
        classNode.nestingShape !== 'ampersand' ||
        !isSameBlockCompound(classNode, context.separatorOptions)
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

      if (!isDirectlyNestedUnderTarget(ancestorRules, expectedParentName, context.separatorOptions)) {
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          messages.modifierNotNestedDirectly,
          classNode.name,
          expectedParentName,
        );
      }
      return;
    }

    // An element may be compounded with its own modifiers — the modifier check above covers those
    // siblings; the element itself still needs block nesting.
    const isCompoundedWithOwnModifiers = (classNode.compoundClassNames ?? []).every((name) =>
      name.startsWith(classNode.name + context.separatorOptions.modifierSeparator),
    );

    // Same reasoning as isAmpersandOnClasslessAncestor: `&` resolving to a classless ancestor
    // carries no real element identity, so this is tag-tolerant just like `td.block__el`.
    const isElementAmpersandOnClasslessAncestor =
      classNode.nestingShape === 'ampersand' &&
      isCompoundedWithOwnModifiers &&
      isAmpersandOnClasslessAncestor(ruleNode);

    const isValidElementShape =
      classNode.nestingShape === 'bare' ||
      isElementAmpersandOnClasslessAncestor ||
      ((classNode.nestingShape === 'class-compound' ||
        isLegitimateChain(classNode, context.separatorOptions)) &&
        isCompoundedWithOwnModifiers);

    if (!isValidElementShape) {
      // `&.block__el` alone is shape-for-shape identical to a valid modifier compound
      // (`&.block--mod`) — worth its own message since it's a common naming/shape mixup, rather
      // than the generic "not its own full selector" message below.
      const isSingleAmpersandCompound = classNode.nestingShape === 'ampersand' && !classNode.compoundClassNames;

      if (isSingleAmpersandCompound) {
        const modifierSuggestion = formatClassName(
          parsed.block,
          [{ separator: 'modifier', name: finalSegment.name }],
          context.separatorOptions,
        );
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
      return;
    }

    // A chain rooted in the element's own block is self-sufficient — equivalent to real nesting
    // even with zero ancestors. An ampersand root still needs a real ancestor (`&` has no meaning
    // without one); a classless root proves nothing about the element's block, so it still needs
    // the ancestor search below.
    const isSelfContainedChain =
      classNode.nestingShape === 'chained' &&
      !classNode.chainRootHasAmpersand &&
      (classNode.chainRootClassNames?.length ?? 0) > 0;

    // Strict requires nesting inside the element's own block; weak accepts nesting under any
    // component's rule (deliberate scoping) but never a flat element.
    if (mode === 'weak') {
      if (ancestorRules.length === 0 && !isSelfContainedChain) {
        reportBemViolation(
          context,
          ruleNode,
          classNode,
          messages.elementNotNestedAnywhere,
          classNode.name,
          expectedParentName,
        );
      }
      return;
    }

    const isNested =
      isSelfContainedChain ||
      ancestorRules.some((ancestor) => ruleDefinesClass(ancestor, expectedParentName, context.separatorOptions));

    if (!isNested) {
      reportBemViolation(
        context,
        ruleNode,
        classNode,
        messages.elementNotNested,
        classNode.name,
        expectedParentName,
      );
    }
  });
}

function isRequireNestingPrimary(value: unknown): value is true | RequireNestingMode {
  return value === true || (isString(value) && (value === 'strict' || value === 'weak'));
}

function resolveRequireNestingMode(primary: true | RequireNestingMode): RequireNestingMode {
  return primary === 'weak' ? 'weak' : 'strict';
}

const rule: stylelint.Rule<true | RequireNestingMode, BemBaseOptions> = (primary, secondaryOptions) => {
  return async (root, result) => {
    const validOptions = validateBemOptions(
      result,
      ruleName,
      primary,
      [isRequireNestingPrimary],
      secondaryOptions,
      bemBaseOptionsSchema,
    );

    if (!validOptions) return;

    const context: RuleContext = {
      ruleName,
      result,
      separatorOptions: resolveSeparatorOptions(secondaryOptions),
      ignoreSelectors: secondaryOptions?.ignoreSelectors,
      messages,
    };

    checkRequireNesting(root, context, resolveRequireNestingMode(primary));
  };
};

rule.ruleName = ruleName;
rule.messages = messages;

export default stylelint.createPlugin(ruleName, rule);
export { messages, ruleName };

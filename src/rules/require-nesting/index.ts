import stylelint from 'stylelint';
import type { Root, Rule } from 'postcss';
import { formatClassName, parseClassName } from '../../utils/bem-parser.js';
import type { BemSeparatorOptions } from '../../utils/bem-parser.js';
import { findAncestorRules } from '../../utils/rule-ancestors.js';
import { bemBaseOptionsSchema, isString, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { getClassNodes, isPureAmpersandPseudoSelector } from '../../utils/selector-walker.js';
import type { ClassNode } from '../../utils/selector-walker.js';
import { forEachBemClass, reportBemViolation } from '../shared/rule-context.js';
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

// parseClassName's block is well-defined even for a non-BEM name (a class with no separator
// parses as isBem: false, block: the class itself) — so this always yields something comparable,
// whether the class is a bare block, one of its elements/modifiers, or an unrelated class.
function blockOf(className: string, separatorOptions: BemSeparatorOptions): string {
  return parseClassName(className, separatorOptions).block;
}

// A chained class's root is a legitimate stand-in for a level of native nesting when it carries
// `&` — which always refers to whatever the real ancestor turns out to be, validated separately —
// when one of the root's classes shares the chained class's own block (e.g. `.block .block__el`,
// or `.block__sibling .block__el` — two elements of the same block, one nested under the other for
// DOM-structure reasons), or when the root carries no class at all (e.g. `summary .block__el`, a
// bare tag standing in for what would otherwise be an unnecessary wrapper div) — a classless root
// introduces no BEM identity to conflict with, the same reasoning as an ampersand-compounded
// element on a classless ancestor (see isAmpersandOnClasslessAncestor). This keeps an arbitrary
// *unrelated* root (`.wrapper .card__title`) from slipping through: `wrapper` isn't part of
// `card`'s block family and isn't classless either, so it's rejected the same as before this shape
// existed. A classless root is legitimate shape-wise, but — unlike a same-block root — it proves
// nothing about which block the element actually belongs to, so it's never treated as
// self-sufficient on its own (see isSelfContainedChain): the "isNested" ancestor search below still
// has to find a real, matching block ancestor.
function isLegitimateChain(classNode: ClassNode, separatorOptions: BemSeparatorOptions): boolean {
  if (classNode.nestingShape !== 'chained') return false;
  if (classNode.chainRootHasAmpersand) return true;

  const rootClassNames = classNode.chainRootClassNames ?? [];
  if (rootClassNames.length === 0) return true;

  const ownBlock = blockOf(classNode.name, separatorOptions);
  return rootClassNames.some((rootClassName) => blockOf(rootClassName, separatorOptions) === ownBlock);
}

// True when a rule's selector(s) carry no BEM (or any other) class at all — only a tag, id,
// universal selector, and/or pseudo-class, e.g. `td`, `td:first-child`, `#id`. Such a rule
// contributes no BEM identity of its own; it exists purely to describe DOM structure (a native
// element wrapper with no class, standing in for what would otherwise be an unnecessary div).
function isClasslessRule(ruleNode: Rule): boolean {
  return ruleNode.selectors.every((selector) => getClassNodes(selector).length === 0);
}

// An ampersand-compounded class whose nearest real ancestor rule is classless (see isClasslessRule)
// — e.g. `td { &.block__element {} }` — resolves "&" to something carrying no class of its own, so
// compounding it with the class is functionally identical to writing the class bare, tag-tolerant
// the same way `td.block__element` already is (a native element given a BEM class directly, no
// wrapper div needed). This is what distinguishes it from a genuinely invalid compound like
// `.block { &.block__element {} }`, where "&" resolves to the block itself and conflates block and
// element identity on one node — there, the nearest ancestor carries a real class and this doesn't
// apply.
function isAmpersandOnClasslessAncestor(ruleNode: Rule): boolean {
  const nearestAncestor = findAncestorRules(ruleNode)[0];
  return nearestAncestor !== undefined && isClasslessRule(nearestAncestor);
}

// A rule "defines" a class when its selector targets exactly that class — bare (`.block`), as
// part of a class-only compound (`.block.block--mod`), reached via a legitimate chain
// (`&.block--mod .block`, or `.block .block__el`, each equivalent to nesting one level deeper), or
// ampersand-compounded on a classless ancestor (see isAmpersandOnClasslessAncestor). Either way,
// everything nested inside can only ever match elements that carry the class.
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

// True when className is itself a modifier whose own expected parent (block or element, its name
// minus its trailing modifier segment) is targetName — e.g. "block--mod" against "block", or
// "block__el--mod" against "block__el". Used to recognize a class compounded via "&" as a genuine
// modifier of the target, not an unrelated class that merely happens to share its ampersand shape.
function isModifierOfTarget(className: string, targetName: string, separatorOptions: BemSeparatorOptions): boolean {
  const parsed = parseClassName(className, separatorOptions);
  const lastSegment = parsed.segments[parsed.segments.length - 1];
  if (!lastSegment || lastSegment.separator !== 'modifier') return false;

  return formatClassName(parsed.block, parsed.segments.slice(0, -1), separatorOptions) === targetName;
}

// A rule whose entire selector is nothing but "&" compounded with modifier(s) of targetName, e.g.
// `&.block--mod` or `&.block--mod1.block--mod2`. Such a rule doesn't itself define targetName in
// its own text, but "&" always refers to whatever real ancestor it's nested inside, so stacking
// these (`&.block--mod1 { &.block--mod2 {} }`) is equivalent to writing every modifier in one
// compound (`&.block--mod1.block--mod2`) directly under targetName — used to let a modifier's
// "directly nested" search collapse through any number of these layers rather than stopping at the
// first one. A genuine wrapper rule (anything else) still isn't tolerated here.
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

// A modifier must be nested directly under the rule that defines its target — but "directly"
// tolerates passing through any number of ancestors that never change what "&" ultimately resolves
// to: either a pure ampersand-modifier compound of that same target (see
// isPureAmpersandModifierCompoundOf, e.g. `&.block--other-mod`), or a pure ampersand-plus-pseudo
// selector (see isPureAmpersandPseudoSelector, e.g. `&:has(.other)`, `&:hover`) that narrows the
// same subject with a pseudo-class condition rather than selecting a different element. The first
// ancestor that's neither the target-defining rule nor one of those transparent layers ends the
// search.
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

// The target's exact name appearing as a compound sibling — regardless of whether that compound
// also carries '&' — is self-evidently a direct pairing: both classes land on the very same node,
// wherever '&' ends up resolving to. This is what lets a modifier compounded alongside its own
// element (`&.block__el.block__el--mod`, e.g. inside a classless tag ancestor like `td { }`) skip
// the ancestor search the same way `.block__el.block__el--mod` (class-compound, no '&') already
// does.
function isCompoundedWith(classNode: ClassNode, className: string): boolean {
  return (
    (classNode.nestingShape === 'class-compound' ||
      classNode.nestingShape === 'chained' ||
      classNode.nestingShape === 'ampersand') &&
    (classNode.compoundClassNames ?? []).includes(className)
  );
}

// Two (or more) modifiers of the same block compounded directly with `&` — e.g.
// `&.block--mod1.block--mod2` — are peers, not parent/child: each is validly paired with the same
// real ancestor regardless of the others, so the pairing is legitimate as long as every sibling
// shares the class's own block. This is the ampersand analogue of a chain root sharing a block
// (isLegitimateChain) — an unrelated sibling (a different block's modifier, or an element rather
// than a modifier of a different block) still isn't a safe pairing and is rejected.
function isSameBlockCompound(classNode: ClassNode, separatorOptions: BemSeparatorOptions): boolean {
  const ownBlock = blockOf(classNode.name, separatorOptions);
  return (classNode.compoundClassNames ?? []).every(
    (name) => blockOf(name, separatorOptions) === ownBlock,
  );
}

// Pseudo-classes whose arguments only filter the subject — a class inside them is a match
// condition, never the element being styled, so it isn't a definition this rule governs.
// `:is()`/`:where()` are absent on purpose: their arguments form the subject itself.
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
    const lastSegment = parsed.segments[parsed.segments.length - 1]!;
    const expectedParentName = formatClassName(
      parsed.block,
      parsed.segments.slice(0, -1),
      context.separatorOptions,
    );

    if (lastSegment.separator === 'modifier') {
      // Compounding a modifier directly with its target (.block.block--mod) pairs the two in the
      // selector itself — equivalent to nesting &.block--mod inside it, so no ancestor is needed.
      if (isCompoundedWith(classNode, expectedParentName)) return;

      // Weak mode leaves a modifier with no ancestor at all unchecked — the common case being a
      // page/feature file adding a modifier onto a block that's defined (and nested) in a
      // different, shared file, which strict mode can never satisfy.
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

    // An element may be compounded with its own modifiers (.block__el.block__el--mod) — the
    // modifier check above covers those siblings; the element itself still needs block nesting.
    // This applies whether the element is the leading compound ('class-compound') or reached via
    // a legitimate chain ('chained', e.g. `&.block--mod .block__el.block__el--mod`, or
    // `.block .block__el.block__el--mod`).
    const isCompoundedWithOwnModifiers = (classNode.compoundClassNames ?? []).every((name) =>
      name.startsWith(classNode.name + context.separatorOptions.modifierSeparator),
    );

    // An element ampersand-compounded on a classless ancestor (`td { &.block__el {} }`) carries no
    // real block/element conflation — "&" resolves to a bare tag, so this is equivalent to writing
    // the class bare, tag-tolerant the same way `td.block__el` already is. This is what
    // distinguishes it from a genuinely invalid `&`-compound like `.block { &.block__el {} }`,
    // where "&" resolves to a real, class-bearing ancestor.
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
      // A single class ampersand-compounded with nothing else (`&.block__el`, no siblings) is
      // shape-for-shape identical to a valid modifier compound (`&.block--mod`) — the same pattern
      // that's the CORRECT way to write a modifier is invalid for an element, since compounding
      // directly with '&' conflates block/element identity on one node. This is common enough
      // (naming something with the element separator while writing it in the modifier's shape, or
      // vice versa) to call out specifically, rather than folding it into the generic "not its own
      // full selector" message below, which doesn't explain *why* this exact shape is the problem.
      const isSingleAmpersandCompound = classNode.nestingShape === 'ampersand' && !classNode.compoundClassNames;

      if (isSingleAmpersandCompound) {
        const modifierSuggestion = formatClassName(
          parsed.block,
          [{ separator: 'modifier', name: lastSegment.name }],
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
        // A compound shape with an unrelated sibling class is reported as not being its own full
        // selector — the compounding itself is the problem, regardless of what real ancestors
        // exist.
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

    // A chain rooted in the element's own block name (not `&`, and not merely classless) is a
    // complete, self-sufficient description of the block/element relationship — equivalent to real
    // nesting even with zero real ancestor rules (e.g. a whole file that's just `.block .block__el
    // { }` inside a transparent @media). An ampersand root still needs a real ancestor: `&` only
    // has meaning inside one. A classless root (e.g. `summary .block__el`) is legitimate shape-wise
    // but proves nothing about the element's actual block, so it isn't self-contained either — it
    // still needs the real ancestor search below to find its block. (Legitimacy of all three was
    // already confirmed by the shape gate above.)
    const isSelfContainedChain =
      classNode.nestingShape === 'chained' &&
      !classNode.chainRootHasAmpersand &&
      (classNode.chainRootClassNames?.length ?? 0) > 0;

    // Strict requires the element nested (at any depth) inside its own block's rule. Weak
    // accepts any ancestor — nesting under a different component's rule is deliberate scoping
    // (customizing this element from within that component) — but never a flat element.
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
    const validPrimary = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [isRequireNestingPrimary],
    });

    if (!validPrimary) return;

    const validSecondary = stylelint.utils.validateOptions(result, ruleName, {
      actual: secondaryOptions,
      possible: bemBaseOptionsSchema,
      optional: true,
    });

    if (!validSecondary) return;

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

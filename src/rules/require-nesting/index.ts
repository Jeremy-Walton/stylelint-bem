import stylelint from 'stylelint';
import type { Root, Rule } from 'postcss';
import { formatClassName, parseClassName } from '../../utils/bem-parser.js';
import type { BemSeparatorOptions } from '../../utils/bem-parser.js';
import { findAncestorRules } from '../../utils/rule-ancestors.js';
import { bemBaseOptionsSchema, isString, resolveSeparatorOptions } from '../../utils/rule-options.js';
import type { BemBaseOptions } from '../../utils/rule-options.js';
import { getClassNodes } from '../../utils/selector-walker.js';
import type { ClassNode } from '../../utils/selector-walker.js';
import { forEachBemClass, reportBemViolation } from '../shared/rule-context.js';
import type { RuleContext } from '../shared/rule-context.js';

type RequireNestingMode = 'strict' | 'weak';

const ruleName = 'stylelint-bem/require-nesting';

const messages = stylelint.utils.ruleMessages(ruleName, {
  elementNotFullSelector: (className: string) =>
    `Expected element ".${className}" to be its own full selector, not compounded with '&'`,
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

// A chained class's root is a legitimate stand-in for a level of native nesting when either it
// carries `&` — which always refers to whatever the real ancestor turns out to be, validated
// separately — or, absent `&`, when one of the root's classes shares the chained class's own
// block (e.g. `.block .block__el`, or `.block__sibling .block__el` — two elements of the same
// block, one nested under the other for DOM-structure reasons). This keeps an arbitrary unrelated
// root (`.wrapper .card__title`) from slipping through: `wrapper` isn't part of `card`'s block
// family, so it's rejected the same as before this shape existed.
function isLegitimateChain(classNode: ClassNode, separatorOptions: BemSeparatorOptions): boolean {
  if (classNode.nestingShape !== 'chained') return false;
  if (classNode.chainRootHasAmpersand) return true;

  const ownBlock = blockOf(classNode.name, separatorOptions);
  return (classNode.chainRootClassNames ?? []).some(
    (rootClassName) => blockOf(rootClassName, separatorOptions) === ownBlock,
  );
}

// A rule "defines" a class when its selector targets exactly that class — bare (`.block`), as
// part of a class-only compound (`.block.block--mod`), or reached via a legitimate chain
// (`&.block--mod .block`, or `.block .block__el`, each equivalent to nesting one level deeper).
// Either way, everything nested inside can only ever match elements that carry the class.
function ruleDefinesClass(ruleNode: Rule, className: string, separatorOptions: BemSeparatorOptions): boolean {
  return ruleNode.selectors.some((selector) =>
    getClassNodes(selector).some(
      (node) =>
        node.name === className &&
        !isInsideNonSubjectPseudo(node) &&
        (node.nestingShape === 'bare' ||
          node.nestingShape === 'class-compound' ||
          isLegitimateChain(node, separatorOptions)),
    ),
  );
}

function isCompoundedWith(classNode: ClassNode, className: string): boolean {
  return (
    (classNode.nestingShape === 'class-compound' || classNode.nestingShape === 'chained') &&
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

      const parentRule = ancestorRules[0];
      if (!parentRule || !ruleDefinesClass(parentRule, expectedParentName, context.separatorOptions)) {
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

    const isValidElementShape =
      classNode.nestingShape === 'bare' ||
      ((classNode.nestingShape === 'class-compound' ||
        isLegitimateChain(classNode, context.separatorOptions)) &&
        isCompoundedWithOwnModifiers);

    if (!isValidElementShape) {
      reportBemViolation(context, ruleNode, classNode, messages.elementNotFullSelector, classNode.name);
      return;
    }

    // A chain rooted in the element's own block name (not `&`) is a complete, self-sufficient
    // description of the block/element relationship — equivalent to real nesting even with zero
    // real ancestor rules (e.g. a whole file that's just `.block .block__el { }` inside a
    // transparent @media). An ampersand root still needs a real ancestor: `&` only has meaning
    // inside one. (Legitimacy was already confirmed by the shape gate above.)
    const isSelfContainedChain = classNode.nestingShape === 'chained' && !classNode.chainRootHasAmpersand;

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

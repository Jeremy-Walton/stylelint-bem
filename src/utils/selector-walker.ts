import parser from 'postcss-selector-parser';

// 'bare' — the class is the sole simple selector leading its selector, e.g. `.block__el` or
// `x-icon.block__el` (a tag/id/universal/pseudo-class compounded alongside doesn't change
// anything — the class must still be present to match, so it's ignored). 'ampersand' — same, but
// compounded with the nesting selector `&`, e.g. `&.block--mod`; may also carry sibling classes
// compounded alongside `&`, e.g. `&.block--mod1.block--mod2`, exposed via `compoundClassNames` —
// requireNesting decides whether those siblings are a legitimate pairing (e.g. two modifiers of
// the same block) or not. 'class-compound' — a leading compound of two or more classes
// (tag/id/universal/pseudo-class tolerated) and nothing else, e.g. `.block.block--mod`; the
// sibling class names are exposed via `compoundClassNames`. 'chained' —
// a class-only compound (same tolerance) exactly one combinator past a leading, clean compound
// (classes, `&`, tag/id/universal/pseudo-class), e.g. the `.block__el` in `&.block--mod .block__el`
// or `x-icon.block:first-child .block__el`; this flattens what would otherwise be a level of
// native nesting (`&.block--mod { .block__el { } }`) into a single selector, so it's treated the
// same way as being nested one level inside that root compound. The root's own class names are
// exposed via `chainRootClassNames` and whether it included `&` via `chainRootHasAmpersand` —
// requireNesting uses these to decide whether a non-ampersand root actually names the class's own
// expected block (an ampersand root needs no such check, since `&` always refers to whatever the
// real ancestor turns out to be). Sibling classes in the class's own compound are exposed via
// `compoundClassNames`, same as 'class-compound'. A selector that starts with a bare combinator,
// e.g. `+ .block__el` or `> summary .block__el` (as written inside a nested rule whose parent
// selector already carries the real ancestor), is also 'chained' with `chainRootHasAmpersand: true`
// — native CSS nesting implicitly treats a leading combinator as if `&` preceded it directly,
// whether it's immediately followed by the class itself (empty `chainRootClassNames`) or by a root
// compound of its own (e.g. the `summary` in `> summary .block__el`, whose own class names, if any,
// are still exposed via `chainRootClassNames`). A root compound with no class at all (a bare tag,
// e.g. `summary .block__el`) also yields empty `chainRootClassNames`, same as an implicit-ampersand
// root — requireNesting treats an empty `chainRootClassNames` as "no identity to conflict with"
// regardless of which of these produced it. 'other' — anything else (a chain more than one hop
// deep, etc.) — used by requireNesting to tell a full selector from a compound one.
type NestingShape = 'bare' | 'ampersand' | 'class-compound' | 'chained' | 'other';

interface ClassNode {
  name: string;
  sourceIndex: number;
  nestingShape: NestingShape;
  compoundClassNames?: string[];
  enclosingPseudos?: string[];
  chainRootHasAmpersand?: boolean;
  chainRootClassNames?: string[];
}

// Pseudo-classes the class sits inside as an argument (e.g. ':has' for `&:has(.block--mod)`),
// outermost first — absent when the class is not inside any pseudo's arguments.
function getEnclosingPseudos(classNode: parser.ClassName): string[] {
  const pseudos: string[] = [];

  for (let node = classNode.parent; node; node = node.parent as parser.Container | undefined) {
    if (node.type === 'pseudo') pseudos.unshift(node.value);
  }

  return pseudos;
}

type ShapeAnalysis = Pick<
  ClassNode,
  'nestingShape' | 'compoundClassNames' | 'chainRootHasAmpersand' | 'chainRootClassNames'
>;

function analyzeNestingShape(classNode: parser.ClassName): ShapeAnalysis {
  const container = classNode.parent;
  if (!container) return { nestingShape: 'other' };

  const siblings = container.nodes;
  const index = siblings.indexOf(classNode);

  let start = index;
  while (start > 0 && siblings[start - 1]!.type !== 'combinator') start--;

  let end = index;
  while (end < siblings.length - 1 && siblings[end + 1]!.type !== 'combinator') end++;

  // A tag/id/universal in the compound (e.g. a custom element `x-icon.block__el`) doesn't
  // change the class-based reasoning this rule cares about — the class must still be present for
  // the compound to match, exactly as if the tag/id/universal weren't there — so it's ignored
  // rather than disqualifying the shape.
  const compound = siblings.slice(start, end + 1);

  const siblingClasses = compound.filter(
    (node): node is parser.ClassName => node !== classNode && node.type === 'class',
  );

  const compoundClassNames =
    siblingClasses.length > 0 ? siblingClasses.map((node) => node.value) : undefined;

  if (compound.some((node) => node.type === 'nesting')) {
    if (start !== 0) return { nestingShape: 'other' };
    return compoundClassNames ? { nestingShape: 'ampersand', compoundClassNames } : { nestingShape: 'ampersand' };
  }

  if (start === 0) {
    return compoundClassNames
      ? { nestingShape: 'class-compound', compoundClassNames }
      : { nestingShape: 'bare' };
  }

  // The compound is preceded by a single combinator with nothing before it at all, e.g. the
  // selector literally starts with `+ .block__el` (as written inside a nested rule whose parent
  // selector already carries the real ancestor, native CSS nesting implicitly treats a selector
  // that starts with a combinator as if `&` preceded it directly — `&+ .block__el` — the same as
  // if it had been written explicitly. Equivalent to an ampersand-rooted chain. This only holds at
  // the real top level of the rule's own selector — a pseudo like `:has(+ .foo)` uses the same
  // leading-combinator shape for its relative-selector argument, an unrelated existential check
  // that has nothing to do with the nesting selector, so it's excluded here.
  if (start === 1 && getEnclosingPseudos(classNode).length === 0) {
    return {
      nestingShape: 'chained',
      ...(compoundClassNames ? { compoundClassNames } : {}),
      chainRootHasAmpersand: true,
      chainRootClassNames: [],
    };
  }

  // Exactly one hop past a leading, clean compound flattens what would otherwise be a level of
  // native nesting into this single selector. A tag/id/universal/pseudo-class in the root doesn't
  // introduce class-identity ambiguity, so it's tolerated the same as in the class's own compound
  // above. The preceding compound must itself start at index 0 (nothing before it) and contain no
  // internal combinator, so deeper chains (two or more hops past the root) fall through to 'other'.
  const precedingCompound = siblings.slice(0, start - 1);

  // The selector's very first node (index 0, unconditionally — `precedingCompound` always starts
  // there) can itself be a bare combinator with nothing before it at all, e.g. `> summary
  // .block__el`, the same implicit-ampersand shorthand handled above for a single-hop selector, but
  // here the root hop it prefixes may itself contain other content (a tag, in this example) before
  // reaching the combinator that separates it from the class's own compound. Strip it before
  // checking the rest of the root compound for cleanliness.
  const hasLeadingImplicitAmpersand = precedingCompound[0]?.type === 'combinator';
  const rootCompound = hasLeadingImplicitAmpersand ? precedingCompound.slice(1) : precedingCompound;
  const rootIsClean =
    precedingCompound.length > 0 && !rootCompound.some((node) => node.type === 'combinator');

  if (!rootIsClean) return { nestingShape: 'other' };

  return {
    nestingShape: 'chained',
    ...(compoundClassNames ? { compoundClassNames } : {}),
    chainRootHasAmpersand:
      hasLeadingImplicitAmpersand || rootCompound.some((node) => node.type === 'nesting'),
    chainRootClassNames: rootCompound
      .filter((node): node is parser.ClassName => node.type === 'class')
      .map((node) => node.value),
  };
}

function getClassNodes(selector: string): ClassNode[] {
  const classNodes: ClassNode[] = [];

  parser((root) => {
    root.walkClasses((classNode) => {
      const enclosingPseudos = getEnclosingPseudos(classNode);

      classNodes.push({
        name: classNode.value,
        sourceIndex: classNode.sourceIndex,
        ...analyzeNestingShape(classNode),
        ...(enclosingPseudos.length > 0 ? { enclosingPseudos } : {}),
      });
    });
  }).processSync(selector);

  return classNodes;
}

function getClassNames(selector: string): string[] {
  return getClassNodes(selector).map((classNode) => classNode.name);
}

// True when a selector is nothing but the nesting selector `&` optionally compounded with one or
// more pseudo-classes and nothing else, e.g. `&:has(.other)`, `&:hover`, `&:focus-visible:hover`.
// Such a selector never changes the subject being styled — it's still whatever `&` resolves to,
// merely with extra pseudo-class conditions attached — so it's transparent for nesting purposes
// the same way an at-rule like `@media` is: requireNesting uses this to let a modifier's "directly
// nested under its target" search pass straight through a pseudo-class wrapper rather than treating
// it as an unrelated ancestor. Any class appearing inside a pseudo's own argument (e.g. `.other` in
// `:has(.other)`) lives in a separate sub-selector and doesn't disqualify this — only a class
// compounded directly with `&` at the top level does (e.g. `&.other-class:hover`, a genuine,
// unrelated pairing). A selector with an internal combinator (a chain, not a single compound) is
// never this shape.
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

export type { ClassNode, NestingShape };
export { getClassNames, getClassNodes, isPureAmpersandPseudoSelector };

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
// `compoundClassNames`, same as 'class-compound'. 'other' — anything else (a chain more than one
// hop deep, etc.) — used by requireNesting to tell a full selector from a compound one.
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

  // Exactly one hop past a leading, clean compound flattens what would otherwise be a level of
  // native nesting into this single selector. A tag/id/universal/pseudo-class in the root doesn't
  // introduce class-identity ambiguity, so it's tolerated the same as in the class's own compound
  // above. The preceding compound must itself start at index 0 (nothing before it) and contain no
  // internal combinator, so deeper chains (two or more hops past the root) fall through to 'other'.
  const precedingCompound = siblings.slice(0, start - 1);
  const precedingIsClean =
    precedingCompound.length > 0 && !precedingCompound.some((node) => node.type === 'combinator');

  if (!precedingIsClean) return { nestingShape: 'other' };

  return {
    nestingShape: 'chained',
    ...(compoundClassNames ? { compoundClassNames } : {}),
    chainRootHasAmpersand: precedingCompound.some((node) => node.type === 'nesting'),
    chainRootClassNames: precedingCompound
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

export type { ClassNode, NestingShape };
export { getClassNames, getClassNodes };

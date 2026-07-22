import parser from 'postcss-selector-parser';

// 'bare' — the class is the sole simple selector (pseudo-classes/attributes aside) leading its
// selector, e.g. `.block__el`. 'ampersand' — same, but compounded with the nesting selector `&`,
// e.g. `&.block--mod`. 'class-compound' — a leading compound of two or more classes and nothing
// else, e.g. `.block.block--mod`; the sibling class names are exposed via `compoundClassNames`.
// 'chained' — a class-only compound exactly one combinator past a leading `&`(+classes) compound,
// e.g. the `.block__el` in `&.block--mod .block__el`; this flattens what would otherwise be two
// levels of native nesting (`&.block--mod { .block__el { } }`) into a single selector, so it's
// treated the same way as being nested one level inside that ampersand compound. Sibling classes
// in its own compound are exposed via `compoundClassNames`, same as 'class-compound'. 'other' —
// anything else (preceded by an unrelated combinator, compounded with a tag/id, etc.) — used by
// requireNesting to tell a full selector from a compound one.
type NestingShape = 'bare' | 'ampersand' | 'class-compound' | 'chained' | 'other';

interface ClassNode {
  name: string;
  sourceIndex: number;
  nestingShape: NestingShape;
  compoundClassNames?: string[];
  enclosingPseudos?: string[];
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

type ShapeAnalysis = Pick<ClassNode, 'nestingShape' | 'compoundClassNames'>;

// True for a compound consisting only of the nesting selector `&` and classes (at least one `&`)
// — the shape of a leading `.block`/`&.block--mod` reference a chained compound can follow.
function isAmpersandChainRoot(compound: parser.Node[]): boolean {
  return (
    compound.some((node) => node.type === 'nesting') &&
    compound.every((node) => node.type === 'nesting' || node.type === 'class')
  );
}

function analyzeNestingShape(classNode: parser.ClassName): ShapeAnalysis {
  const container = classNode.parent;
  if (!container) return { nestingShape: 'other' };

  const siblings = container.nodes;
  const index = siblings.indexOf(classNode);

  let start = index;
  while (start > 0 && siblings[start - 1]!.type !== 'combinator') start--;

  let end = index;
  while (end < siblings.length - 1 && siblings[end + 1]!.type !== 'combinator') end++;

  const compound = siblings.slice(start, end + 1);
  const hasDisqualifyingNode = compound.some(
    (node) => node.type === 'tag' || node.type === 'id' || node.type === 'universal',
  );
  if (hasDisqualifyingNode) return { nestingShape: 'other' };

  const siblingClasses = compound.filter(
    (node): node is parser.ClassName => node !== classNode && node.type === 'class',
  );

  if (compound.some((node) => node.type === 'nesting')) {
    if (start !== 0) return { nestingShape: 'other' };
    return siblingClasses.length === 0 ? { nestingShape: 'ampersand' } : { nestingShape: 'other' };
  }

  const compoundClassNames =
    siblingClasses.length > 0 ? siblingClasses.map((node) => node.value) : undefined;

  if (start === 0) {
    return compoundClassNames
      ? { nestingShape: 'class-compound', compoundClassNames }
      : { nestingShape: 'bare' };
  }

  // Exactly one hop past a leading `&`(+classes) compound flattens what would otherwise be a
  // level of native nesting into this single selector — treated the same as being nested inside
  // it. The preceding compound must itself start at index 0 (nothing before it) and contain no
  // internal combinator, so deeper chains (two or more hops past the root) fall through to 'other'.
  const precedingCompound = siblings.slice(0, start - 1);
  const isChained =
    !precedingCompound.some((node) => node.type === 'combinator') &&
    isAmpersandChainRoot(precedingCompound);

  if (!isChained) return { nestingShape: 'other' };

  return compoundClassNames ? { nestingShape: 'chained', compoundClassNames } : { nestingShape: 'chained' };
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

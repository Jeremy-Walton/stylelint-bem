import parser from 'postcss-selector-parser';

// 'bare' — the class is the sole simple selector (pseudo-classes/attributes aside) leading its
// selector, e.g. `.block__el`. 'ampersand' — same, but compounded with the nesting selector `&`,
// e.g. `&.block--mod`. 'class-compound' — a leading compound of two or more classes and nothing
// else, e.g. `.block.block--mod`; the sibling class names are exposed via `compoundClassNames`.
// 'other' — anything else (preceded by a combinator, compounded with a tag/id, etc.) — used by
// requireNesting to tell a full selector from a compound one.
type NestingShape = 'bare' | 'ampersand' | 'class-compound' | 'other';

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

function analyzeNestingShape(classNode: parser.ClassName): ShapeAnalysis {
  const container = classNode.parent;
  if (!container) return { nestingShape: 'other' };

  const siblings = container.nodes;
  const index = siblings.indexOf(classNode);

  let start = index;
  while (start > 0 && siblings[start - 1]!.type !== 'combinator') start--;
  if (start !== 0) return { nestingShape: 'other' };

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
    return siblingClasses.length === 0 ? { nestingShape: 'ampersand' } : { nestingShape: 'other' };
  }

  if (siblingClasses.length === 0) return { nestingShape: 'bare' };

  return {
    nestingShape: 'class-compound',
    compoundClassNames: siblingClasses.map((node) => node.value),
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

import parser from 'postcss-selector-parser';

// 'bare' — the class is the sole simple selector (pseudo-classes/attributes aside) leading its
// selector, e.g. `.block__el`. 'ampersand' — same, but compounded with the nesting selector `&`,
// e.g. `&.block--mod`. 'other' — anything else (preceded by a combinator, compounded with another
// class/tag/id, etc.) — used by requireNesting to tell a full selector from a compound one.
type NestingShape = 'bare' | 'ampersand' | 'other';

interface ClassNode {
  name: string;
  sourceIndex: number;
  nestingShape: NestingShape;
}

function computeNestingShape(classNode: parser.ClassName): NestingShape {
  const container = classNode.parent;
  if (!container) return 'other';

  const siblings = container.nodes;
  const index = siblings.indexOf(classNode);

  let start = index;
  while (start > 0 && siblings[start - 1]!.type !== 'combinator') start--;
  if (start !== 0) return 'other';

  let end = index;
  while (end < siblings.length - 1 && siblings[end + 1]!.type !== 'combinator') end++;

  const compound = siblings.slice(start, end + 1);
  const hasDisqualifyingNode = compound.some(
    (node) =>
      node !== classNode &&
      (node.type === 'tag' || node.type === 'id' || node.type === 'universal' || node.type === 'class'),
  );
  if (hasDisqualifyingNode) return 'other';

  return compound.some((node) => node.type === 'nesting') ? 'ampersand' : 'bare';
}

function getClassNodes(selector: string): ClassNode[] {
  const classNodes: ClassNode[] = [];

  parser((root) => {
    root.walkClasses((classNode) => {
      classNodes.push({
        name: classNode.value,
        sourceIndex: classNode.sourceIndex,
        nestingShape: computeNestingShape(classNode),
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

import parser from 'postcss-selector-parser';

interface ClassNode {
  name: string;
  sourceIndex: number;
}

function getClassNodes(selector: string): ClassNode[] {
  const classNodes: ClassNode[] = [];

  parser((root) => {
    root.walkClasses((classNode) => {
      classNodes.push({ name: classNode.value, sourceIndex: classNode.sourceIndex });
    });
  }).processSync(selector);

  return classNodes;
}

function getClassNames(selector: string): string[] {
  return getClassNodes(selector).map((classNode) => classNode.name);
}

export type { ClassNode };
export { getClassNames, getClassNodes };

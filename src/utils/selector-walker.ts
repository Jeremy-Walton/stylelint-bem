import parser from 'postcss-selector-parser';

function getClassNames(selector: string): string[] {
  const classNames: string[] = [];

  parser((root) => {
    root.walkClasses((classNode) => {
      classNames.push(classNode.value);
    });
  }).processSync(selector);

  return classNames;
}

export { getClassNames };

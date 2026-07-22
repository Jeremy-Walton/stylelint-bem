import parser from 'postcss-selector-parser';

// A class's shape relative to its own selector:
// - 'bare': the sole class leading the selector, e.g. `.block__el`
// - 'ampersand': compounded with `&`, e.g. `&.block--mod`; siblings in `compoundClassNames`
// - 'class-compound': a leading compound of 2+ classes, e.g. `.block.block--mod`; siblings in `compoundClassNames`
// - 'chained': one combinator past a leading compound, e.g. `.block .block__el`; the root's own
//   classes/ampersand are exposed via `chainRootClassNames`/`chainRootHasAmpersand`
// - 'other': anything deeper or messier than the above
// A tag/id/universal/pseudo-class riding along in a compound doesn't change any of this — the
// class must still be present to match, so it's ignored throughout.
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
// outermost first.
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

  let compoundStart = index;
  while (compoundStart > 0 && siblings[compoundStart - 1]!.type !== 'combinator') compoundStart--;

  let compoundEnd = index;
  while (compoundEnd < siblings.length - 1 && siblings[compoundEnd + 1]!.type !== 'combinator') compoundEnd++;

  const ownCompound = siblings.slice(compoundStart, compoundEnd + 1);

  const siblingClasses = ownCompound.filter(
    (node): node is parser.ClassName => node !== classNode && node.type === 'class',
  );

  const compoundClassNames =
    siblingClasses.length > 0 ? siblingClasses.map((node) => node.value) : undefined;

  if (ownCompound.some((node) => node.type === 'nesting')) {
    if (compoundStart !== 0) return { nestingShape: 'other' };
    return compoundClassNames ? { nestingShape: 'ampersand', compoundClassNames } : { nestingShape: 'ampersand' };
  }

  if (compoundStart === 0) {
    return compoundClassNames
      ? { nestingShape: 'class-compound', compoundClassNames }
      : { nestingShape: 'bare' };
  }

  // A leading bare combinator (`+ .block__el`, `> summary .block__el`) is how native nesting
  // renders once its parent selector is substituted in — CSS treats it as if `&` preceded it
  // directly. Excluded inside a pseudo's own relative-selector argument (e.g. `:has(+ .foo)`),
  // which reuses this same shape for an unrelated existential check.
  if (compoundStart === 1 && getEnclosingPseudos(classNode).length === 0) {
    return {
      nestingShape: 'chained',
      ...(compoundClassNames ? { compoundClassNames } : {}),
      chainRootHasAmpersand: true,
      chainRootClassNames: [],
    };
  }

  // Exactly one hop past a leading, clean compound flattens what would otherwise be a level of
  // nesting into one selector; two or more hops falls through to 'other'.
  const precedingCompound = siblings.slice(0, compoundStart - 1);

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

// True when a selector is only the nesting selector `&`, optionally compounded with pseudo-classes
// (e.g. `&:has(.other)`, `&:hover`) — the subject is still whatever `&` resolves to, so this is
// transparent for nesting purposes the same way `@media` is.
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

import parser from 'postcss-selector-parser';

// A class's shape relative to its own selector:
// - 'bare': the sole class leading the selector, e.g. `.block__el`
// - 'ampersand': compounded with `&`, e.g. `&.block--mod`; siblings in `compoundClassNames`
// - 'class-compound': a leading compound of 2+ classes, e.g. `.block.block--mod`; siblings in `compoundClassNames`
// - 'chained': one combinator past a leading compound, e.g. `.block .block__el`; the root compound
//   it hangs off is described by `chainRoot`
// - 'other': anything deeper or messier than the above
// A tag/id/universal/pseudo-class riding along in a compound doesn't change any of this — the
// class must still be present to match, so it's ignored throughout.
type NestingShape = 'bare' | 'ampersand' | 'class-compound' | 'chained' | 'other';

// What a 'chained' class hangs off — the leading root compound one hop back:
// - 'ampersand': the root is (or resolves through) `&`, e.g. `&.block--mod .block__el` or a bare
//   leading combinator `+ .block__el`; its own class names are irrelevant, so they aren't carried
// - 'classless': the root carries only a tag/pseudo, e.g. `summary .block__el` — no BEM identity
// - 'classes': the root is one or more literal classes, e.g. `.block .block__el`, listed in `names`
type ChainRoot =
  | { kind: 'ampersand' }
  | { kind: 'classless' }
  | { kind: 'classes'; names: string[] };

interface ClassNode {
  name: string;
  sourceIndex: number;
  nestingShape: NestingShape;
  compoundClassNames?: string[];
  enclosingPseudos?: string[];
  chainRoot?: ChainRoot;
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

type ShapeAnalysis = Pick<ClassNode, 'nestingShape' | 'compoundClassNames' | 'chainRoot'>;

// Classify the leading root compound a chained class hangs off. An `&` anywhere in the root (or a
// leading bare combinator, which native nesting treats as an implicit `&`) makes it ampersand-rooted
// regardless of any classes alongside; otherwise it's the literal classes, or classless if none.
function classifyChainRoot(rootCompound: parser.Node[], hasLeadingImplicitAmpersand: boolean): ChainRoot {
  if (hasLeadingImplicitAmpersand || rootCompound.some((node) => node.type === 'nesting')) {
    return { kind: 'ampersand' };
  }

  const names = rootCompound
    .filter((node): node is parser.ClassName => node.type === 'class')
    .map((node) => node.value);

  return names.length > 0 ? { kind: 'classes', names } : { kind: 'classless' };
}

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
      chainRoot: { kind: 'ampersand' },
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
    chainRoot: classifyChainRoot(rootCompound, hasLeadingImplicitAmpersand),
  };
}

function collectClassNodes(container: parser.Root | parser.Selector): ClassNode[] {
  const classNodes: ClassNode[] = [];

  container.walkClasses((classNode) => {
    const enclosingPseudos = getEnclosingPseudos(classNode);

    classNodes.push({
      name: classNode.value,
      sourceIndex: classNode.sourceIndex,
      ...analyzeNestingShape(classNode),
      ...(enclosingPseudos.length > 0 ? { enclosingPseudos } : {}),
    });
  });

  return classNodes;
}

function getClassNodes(selector: string): ClassNode[] {
  let classNodes: ClassNode[] = [];

  parser((root) => {
    classNodes = collectClassNodes(root);
  }).processSync(selector);

  return classNodes;
}

interface SelectorGroup {
  selector: string;
  classNodes: ClassNode[];
}

// Parses a rule's full (possibly comma-separated) selector in one pass, grouped back into its
// top-level selectors — each group's classNodes carry sourceIndex relative to the whole string,
// so callers reporting a warning position don't need to re-anchor per selector themselves.
function getClassNodesBySelectorGroup(fullSelector: string): SelectorGroup[] {
  const groups: SelectorGroup[] = [];

  parser((root) => {
    root.each((selectorNode) => {
      groups.push({ selector: String(selectorNode).trim(), classNodes: collectClassNodes(selectorNode) });
    });
  }).processSync(fullSelector);

  return groups;
}

function getClassNames(selector: string): string[] {
  return getClassNodes(selector).map((classNode) => classNode.name);
}

export type { ChainRoot, ClassNode, NestingShape };
export { getClassNames, getClassNodes, getClassNodesBySelectorGroup };

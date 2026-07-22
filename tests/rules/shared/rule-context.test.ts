import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { forEachBemClass } from '@src/rules/shared/rule-context.js';
import type { RuleContext } from '@src/rules/shared/rule-context.js';

const separatorOptions = { elementSeparator: '__', modifierSeparator: '--' };

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    ruleName: 'stylelint-bem/test',
    result: {} as RuleContext['result'],
    separatorOptions,
    messages: {},
    ...overrides,
  };
}

describe('forEachBemClass', () => {
  it('reports a source index relative to the whole rule selector, not reset per selector, for a comma-separated selector list', () => {
    const code = '.password-criteria__input, div[data-component="X"], .form-control--date {}';
    const root = postcss.parse(code);

    const seen: Array<{ name: string; sourceIndex: number }> = [];
    forEachBemClass(root, makeContext(), (_ruleNode, classNode) => {
      seen.push({ name: classNode.name, sourceIndex: classNode.sourceIndex });
    });

    // sourceIndex points at the leading '.', so slicing name.length + 1 characters from it
    // should reproduce ".<name>" verbatim at its true position in the full rule selector.
    expect(seen).toEqual([
      { name: 'password-criteria__input', sourceIndex: 0 },
      { name: 'form-control--date', sourceIndex: 52 },
    ]);

    for (const { name, sourceIndex } of seen) {
      expect(code.slice(sourceIndex, sourceIndex + name.length + 1)).toBe(`.${name}`);
    }
  });
});

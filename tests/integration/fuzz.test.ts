import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import recommended from '@src/configs/recommended.js';

async function lint(code: string) {
  const result = await stylelint.lint({
    code,
    config: recommended,
  });

  return result.results[0]!.warnings;
}

describe('fuzz-ish pass — weird but valid selectors', () => {
  it('does not crash or false-positive on :is()/:not() wrapping properly nested elements', async () => {
    const warnings = await lint('.card { :is(.card__title, .card__body) {} }');
    expect(warnings).toEqual([]);
  });

  it('does not crash or false-positive on :not() containing an unrelated class', async () => {
    const warnings = await lint('.card { .card__title:not(.is-hidden) {} }');
    expect(warnings).toEqual([]);
  });

  it('does not crash or false-positive on an attribute selector attached to a nested element', async () => {
    const warnings = await lint('.card { .card__title[data-active] {} }');
    expect(warnings).toEqual([]);
  });

  it('does not crash or false-positive on an attribute selector attached to a compound modifier', async () => {
    const warnings = await lint('.card { &.card--featured[data-active] {} }');
    expect(warnings).toEqual([]);
  });

  it('does not crash on a universal selector combined with a combinator', async () => {
    const warnings = await lint('* > .card__title {}');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('does not crash on an id selector', async () => {
    const warnings = await lint('#main .card__title {}');
    expect(() => warnings).not.toThrow();
  });

  it('does not crash on an empty selector list entry from a trailing comma-like construct', async () => {
    await expect(lint('.card, .card__title {}')).resolves.not.toThrow();
  });

  it('does not crash on deeply nested at-rules mixed with pseudo-classes', async () => {
    const warnings = await lint(
      '.card { @media (min-width: 600px) { @supports (display: grid) { .card__title:hover {} } } }',
    );
    expect(warnings).toEqual([]);
  });

  it('flags a class compounded with another non-BEM class as not a full selector (documented strictness, not a crash)', async () => {
    const warnings = await lint('.card { .is-visible.card__title {} }');
    expect(warnings.map((w) => w.text)).toEqual([
      expect.stringContaining('to be its own full selector'),
    ]);
  });

  it('does not crash on a selector using the nesting selector standalone', async () => {
    await expect(lint('.card { & {} }')).resolves.not.toThrow();
  });
});

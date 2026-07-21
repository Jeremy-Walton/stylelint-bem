import stylelint from 'stylelint';
import type { Plugin } from 'stylelint';
import { describe, expect, it } from 'vitest';

interface AcceptCase {
  description: string;
  code: string;
}

interface RejectCase {
  description: string;
  code: string;
  warnings: Array<{ message: string; line?: number }>;
}

interface TestRuleOptions {
  plugin: Plugin;
  ruleName: string;
  config: unknown;
  accept?: AcceptCase[];
  reject?: RejectCase[];
}

async function lint(plugin: Plugin, ruleName: string, config: unknown, code: string) {
  const result = await stylelint.lint({
    code,
    config: { plugins: [plugin], rules: { [ruleName]: config } },
  });

  return result.results[0]!.warnings.filter((warning) => warning.rule === ruleName);
}

function testRule({ plugin, ruleName, config, accept = [], reject = [] }: TestRuleOptions): void {
  describe(ruleName, () => {
    for (const testCase of accept) {
      it(`accepts: ${testCase.description}`, async () => {
        const warnings = await lint(plugin, ruleName, config, testCase.code);
        expect(warnings).toEqual([]);
      });
    }

    for (const testCase of reject) {
      it(`rejects: ${testCase.description}`, async () => {
        const warnings = await lint(plugin, ruleName, config, testCase.code);
        expect(warnings.map((warning) => ({ text: warning.text, line: warning.line }))).toEqual(
          testCase.warnings.map((warning) => ({
            text: warning.message,
            line: warning.line ?? expect.any(Number),
          })),
        );
      });
    }
  });
}

export { testRule };

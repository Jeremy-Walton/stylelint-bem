import type { PostcssResult, RuleMessage } from 'stylelint';
import type { BemSeparatorOptions } from '../../utils/bem-parser.js';

interface CheckContext {
  ruleName: string;
  result: PostcssResult;
  separatorOptions: BemSeparatorOptions;
  ignoreSelectors?: (string | RegExp)[];
  definedClassIndex: Set<string>;
  message: RuleMessage;
}

export type { CheckContext };

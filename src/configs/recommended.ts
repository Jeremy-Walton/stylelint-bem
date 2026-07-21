import type { Config } from 'stylelint';
import plugins from '../index.js';
import { ruleName } from '../rules/stylelint-bem/index.js';

const config: Config = {
  plugins,
  rules: {
    [ruleName]: true,
  },
};

export default config;

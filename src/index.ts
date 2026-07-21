import type { Plugin } from 'stylelint';
import stylelintBem from './rules/stylelint-bem/index.js';

const plugins: Plugin[] = [stylelintBem];

export default plugins;

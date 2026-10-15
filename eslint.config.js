import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'tests/fixtures/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, chrome: 'readonly' } },
    // Security rules from PLAN.md §4 / §10: no eval, no HTML-string injection.
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Set text with textContent; innerHTML/outerHTML assignment is forbidden.',
        },
        {
          selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: 'insertAdjacentHTML is forbidden; build DOM nodes instead.',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);

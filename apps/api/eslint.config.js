import config from '@nxserve/config/eslint';

export default [
  ...config,
  {
    rules: {
      // NestJS relies on decorator metadata and constructor injection, so the
      // tokens it injects must be value imports, not `import type`.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];

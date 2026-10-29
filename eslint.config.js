import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-pages',
      'dist-e2e',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'dexie', message: 'Use the Repository (src/data) instead of Dexie directly.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Phase 7: no focused or "fixme" tests in the repository (skips need a platform reason).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.name=/^(test|it|describe)$/][property.name=/^(only|fixme)$/]',
          message: 'Nada de .only/.fixme no repositório.',
        },
        {
          selector:
            "MemberExpression[object.object.name='test'][object.property.name='describe'][property.name=/^(only|fixme)$/]",
          message: 'Nada de .only/.fixme no repositório.',
        },
      ],
    },
  },
  {
    files: ['src/data/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);

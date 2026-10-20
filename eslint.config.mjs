import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,mjs}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { jsdoc },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      'no-param-reassign': ['error', { props: true }],
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ClassDeclaration', message: 'Use functions instead of application classes.' },
        { selector: 'ClassExpression', message: 'Use functions instead of application classes.' },
        { selector: 'ThisExpression', message: 'Pass dependencies explicitly instead of using this.' },
      ],
      'jsdoc/require-jsdoc': ['error', {
        enableFixer: false,
        contexts: [':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)'],
        require: {
          FunctionDeclaration: false,
          FunctionExpression: false,
          ArrowFunctionExpression: false,
        },
      }],
      'jsdoc/require-description': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];

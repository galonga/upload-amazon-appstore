import github from 'eslint-plugin-github'
import jest from 'eslint-plugin-jest'
import globals from 'globals'

export default [
  {ignores: ['**/dist/**', '**/lib/**', '**/node_modules/**', '**/coverage/**', '**/*.js', '**/*.mjs']},
  github.getFlatConfigs().recommended,
  ...github.getFlatConfigs().typescript,
  jest.configs['flat/recommended'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {...globals.node, ...globals.jest},
      parserOptions: {
        ecmaVersion: 9,
        sourceType: 'module',
        project: './tsconfig.eslint.json'
      }
    },
    rules: {
      'eslint-comments/no-use': 'off',
      'import/no-namespace': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      'i18n-text/no-en': 'off',
      'filenames/match-regex': 'off',
      'github/no-then': 'off'
    }
  }
]

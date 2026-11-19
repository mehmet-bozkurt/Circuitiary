// ESLint (flat config): mistakes, not formatting. The project keeps its own compact layout
// (long template lines on purpose), so no stylistic rule is enabled here.
// TypeScript's own checks (`npm run typecheck`: strict, noUnusedLocals, noUnusedParameters)
// stay the source of truth for types and unused code.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'data/', '.venv/', 'docs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Build and test configuration, the local data endpoint and the Playwright specs run in Node.
    files: ['*.config.{js,ts}', 'vite.local-data.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // Unit tests read parsed JSON and poke at deliberately malformed input.
    files: ['src/**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    rules: {
      // The compiler already reports unused locals and parameters; one report is enough.
      '@typescript-eslint/no-unused-vars': 'off',
      // The page components are named after what they show (App, Shell).
      'vue/multi-word-component-names': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
)

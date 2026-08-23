import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  // 'flat/essential' (correctness only) rather than 'flat/recommended'
  // (which adds stylistic rules — attribute-per-line, self-closing tags,
  // etc.) — this is an existing codebase with its own formatting
  // conventions, not a blank slate; a stylistic ruleset would flag ~500
  // pre-existing lines across every view for no functional reason.
  ...pluginVue.configs['flat/essential'],
  {
    rules: {
      // Single-word view/component names (HomeView, LoginView, etc. are
      // fine as-is) — this project doesn't follow the multi-word
      // convention and renaming now isn't worth the churn.
      'vue/multi-word-component-names': 'off',
    },
  },
]

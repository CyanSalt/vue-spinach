import config from '@cyansalt/eslint-config'

export default config({
  configs: [
    {
      languageOptions: {
        parserOptions: {
          project: [
            './tsconfig.lib.json',
            './tsconfig.node.json',
          ],
        },
      },
    },
    {
      files: ['tests/**/*.vue'],
      rules: {
        'sort-imports': 'off',
        'vue/define-emits-declaration': 'off',
        'vue/define-props-declaration': 'off',
        'vue/match-component-file-name': 'off',
        'vue/no-ref-object-reactivity-loss': 'off',
        'vue/no-unused-properties': 'off',
        'vue/require-emit-validator': 'off',
        'galaxy/vue-ref-style': 'off',
      },
    },
  ],
})

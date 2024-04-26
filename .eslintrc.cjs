module.exports = {
  root: true,
  extends: [
    '@cyansalt/preset',
  ],
  parserOptions: {
    project: './tsconfig.tools.json',
  },
  overrides: [
    {
      files: ['tests/**/*.vue'],
      rules: {
        'sort-imports': 'off',
        '@stylistic/ts/indent': 'off',
        'vue/define-emits-declaration': 'off',
        'vue/define-props-declaration': 'off',
        'vue/match-component-file-name': 'off',
        'vue/no-ref-object-reactivity-loss': 'off',
        'vue/no-unused-properties': 'off',
        'vue/require-emit-validator': 'off',
      },
    },
  ],
}

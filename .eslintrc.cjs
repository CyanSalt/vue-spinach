module.exports = {
  root: true,
  extends: [
    '@cyansalt/preset',
  ],
  parserOptions: {
    project: './tsconfig.tools.json',
  },
  rules: {
    'vue/match-component-file-name': 'off',
    'vue/no-unused-properties': 'off',
  },
}

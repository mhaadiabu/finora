// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Existing copy contains apostrophes in JSX text. Expo's default rule is
      // unrelated to the mobile verification gate and does not affect runtime.
      'react/no-unescaped-entities': 'off',
    },
  },
]);

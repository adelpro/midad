// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const eslintConfigPrettier = require('eslint-config-prettier');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    ignores: [
      'dist/*',
      'web-build/*',
      'ios/*',
      'android/*',
      'assets/*',
      'public/*',
      'docs/*',
    ],
  },
]);

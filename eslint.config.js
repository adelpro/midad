// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    ignores: ['dist/*'],
  },
  {
    // `scripts/**/*.mjs` are Node scripts. Expo's config registers the browser
    // globals only, so `Buffer` read as undefined and left `eslint src scripts`
    // permanently red for the two glyph tools.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { Buffer: 'readonly' },
    },
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

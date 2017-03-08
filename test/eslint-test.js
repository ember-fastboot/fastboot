'use strict';

const lint = require('mocha-eslint');

// Array of paths to lint
// Note: a seperate Mocha test will be run for each path and each file which
// matches a glob pattern
let paths = [
  'src/**/*.js',
  'test/**/*.js',
  '!test/fixtures/**', // negation also works
  '!test/eslint-test.js',
];

let options = {
  // Consider linting warnings as errors and return failure
  strict: true,  // Defaults to `false`, only notify the warnings
};

// Run the tests
lint(paths, options);

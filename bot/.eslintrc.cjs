module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    'src/bot responses/**/*.json'
  ],
  rules: {
    'no-console': 'off',
    'no-undef': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
};

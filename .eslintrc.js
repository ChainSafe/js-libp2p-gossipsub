// from https://dev.to/itmayziii/typescript-eslint-and-standardjs-5hmd
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json' // Required to have rules that rely on Types.
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended', // Out of the box Typescript rules
    'standard' // Out of the box StandardJS rules
  ],
  plugins: [
    '@typescript-eslint', // Let's us override rules below.
    'eslint-plugin-import',
    'eslint-plugin-node',
    'prettier'
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowNullableBoolean: true,
        allowNullableString: true,
        allowAny: true
      }
    ],

    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        // Prevents us from using any delimiter for interface properties.
        multiline: {
          delimiter: 'none',
          requireLast: false
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }
    ],
    '@typescript-eslint/indent': 'off', // This is the job of StandardJS, they are competing rules so we turn off the Typescript one.
    'node/no-unsupported-features/es-syntax': 'off', // Allows us to use Import and Export keywords.
    'no-mixed-operators': 'off',
    'space-before-function-paren': 'off',
    'comma-dangle': 'off',
    indent: 'off'
  }
}

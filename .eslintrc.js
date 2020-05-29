// from https://dev.to/itmayziii/typescript-eslint-and-standardjs-5hmd
module.exports = {
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'project': './tsconfig.json', // Required to have rules that rely on Types.
    'tsconfigRootDir': './'
  },
  'extends': [
    'plugin:@typescript-eslint/recommended', // Out of the box Typescript rules
    'standard' // Out of the box StandardJS rules
  ],
  'plugins': [
    '@typescript-eslint' // Let's us override rules below.
  ],
  'rules': {
//    '@typescript-eslint/no-use-before-define': 'off', // Allows us to hoist variables and functions which I am a fan of, functions not variables that is.
//    '@typescript-eslint/no-explicit-any': 'off', // Too strict for my case, sometimes I need an any type
    '@typescript-eslint/member-delimiter-style': ['error', { // Prevents us from using any delimiter for interface properties.
      'multiline': {
        'delimiter': 'none',
        'requireLast': false
      },
      'singleline': {
        'delimiter': 'comma',
        'requireLast': false
      }
    }],
    '@typescript-eslint/indent': 'off', // This is the job of StandardJS, they are competing rules so we turn off the Typescript one.
    'no-unused-vars': 'off', // On the fence about using this one, sometimes we import a package that is never used directly.
    'node/no-unsupported-features/es-syntax': 'off', // Allows us to use Import and Export keywords.
    '@typescript-eslint/no-non-null-assertion': 'off',
    'no-mixed-operators': 'off'
  }
}

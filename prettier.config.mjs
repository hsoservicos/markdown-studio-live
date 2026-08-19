/** @type {import('prettier').Config} */
export default {
  arrowParens: 'always',
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  printWidth: 100,
  overrides: [
    {
      files: ['*.md'],
      options: {
        proseWrap: 'preserve',
      },
    },
  ],
};

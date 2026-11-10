import type { Config } from 'prettier';

const config: Config = {
  experimentalTernaries: true,
  experimentalOperatorPosition: 'end',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  trailingComma: 'none',
  bracketSpacing: true,
  objectWrap: 'preserve',
  arrowParens: 'always',
  rangeStart: 0,
  rangeEnd: Infinity,
  requirePragma: false,
  insertPragma: false,
  checkIgnorePragma: false,
  proseWrap: 'preserve',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      options: {
        singleQuote: true
      }
    },
    {
      files: ['*.md', '*.markdown', '*.mdx'],
      options: {
        proseWrap: 'never'
      }
    }
  ]
};

export default config;

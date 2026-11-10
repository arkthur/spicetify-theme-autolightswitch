import type { Config } from 'stylelint';

const config: Config = {
  overrides: [
    {
      files: ['**/*.css'],
      extends: [
        'stylelint-config-standard',
        './stylelint-config-experimental/index.ts'
      ]
    }
  ],
  rules: {}
};

export default config;

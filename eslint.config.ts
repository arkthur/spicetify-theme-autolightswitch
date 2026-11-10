import type {
  ConfigWithExtends as BaseConfigWithExtends,
  ExtendsElement
} from '@eslint/config-helpers';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import { configs as tsConfigs, plugin as tsPlugin } from 'typescript-eslint';

import type { RuleOptions } from './eslint-typegen.d.ts';
import { typegen } from './eslint.typegen.ts';

// Rule names and options are checked against the generated `RuleOptions`. The
// mapped type (unlike the interface) has an implicit index signature, so it
// stays assignable to ESLint's `RulesConfig`.
interface ConfigWithExtends extends Omit<BaseConfigWithExtends, 'rules'> {
  rules?: { [R in keyof RuleOptions]: RuleOptions[R] };
}

const tsConfigBaseExtends: ExtendsElement[] = [
  js.configs.recommended,
  tsConfigs.strictTypeChecked,
  tsConfigs.stylisticTypeChecked
];

const importsConfig: ConfigWithExtends = {
  files: ['**/*.{js,ts,tsx}'],
  plugins: {
    'import-x': importX,
    '@typescript-eslint': tsPlugin
  },
  extends: ['import-x/flat/recommended', 'import-x/flat/typescript'],
  settings: {
    'import-x/resolver-next': [
      createTypeScriptImportResolver({
        extensions: ['.js', '.ts', '.tsx'],
        project: ['tsconfig.json']
      })
    ]
  },
  rules: {
    // Recommended ships these as warnings.
    // Mixed value/type imports stay inline (`import { a, type B }`) and are
    // merged into one statement; all-type imports use `import type { A, B }`
    // (`no-import-type-side-effects` rewrites an all-inline `{ type A }`).
    'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
    'import-x/no-named-as-default': 'error',
    'import-x/no-named-as-default-member': 'error',

    'import-x/no-cycle': 'error',
    'import-x/no-self-import': 'error',
    'import-x/no-useless-path-segments': 'error',
    'import-x/no-relative-packages': 'error',
    'import-x/no-empty-named-blocks': 'error',
    'import-x/no-mutable-exports': 'error',
    'import-x/no-absolute-path': 'error',
    'import-x/no-import-module-exports': 'error',
    'import-x/no-dynamic-require': 'error',
    'import-x/no-webpack-loader-syntax': 'error',
    'import-x/no-deprecated': 'error',
    'import-x/first': 'error',
    'import-x/newline-after-import': ['error', { considerComments: true }],

    'import-x/no-default-export': 'error',
    'import-x/no-namespace': ['error', { ignore: ['react', 'recharts'] }],
    'import-x/no-unassigned-import': [
      'error',
      { allow: ['**/*.css', '@testing-library/jest-dom/vitest'] }
    ],
    'import-x/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/*.config.ts',
          '**/eslint.*.ts',
          'stylelint-config-experimental/*.ts'
        ],
        optionalDependencies: false,
        peerDependencies: false
      }
    ],
    'import-x/max-dependencies': ['error', { max: 40 }],

    'import-x/no-unresolved': ['error', { ignore: ['globals'] }],
    'import-x/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['sibling', 'parent'],
          'index',
          'unknown'
        ],
        pathGroupsExcludedImportTypes: [],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true
      }
    ],
    '@typescript-eslint/no-import-type-side-effects': 'error'
  }
};

const importsConfigFilesConfig: ConfigWithExtends = {
  files: ['*.config.ts', 'stylelint-config-experimental/*.ts'],
  rules: { 'import-x/no-default-export': 'off' }
};

const rootConfig: ConfigWithExtends = {
  files: ['*.ts', 'stylelint-config-experimental/*.ts'],
  extends: tsConfigBaseExtends,
  languageOptions: {
    parserOptions: {
      project: './tsconfig.json'
    }
  }
};

const jsConfig: ConfigWithExtends = {
  files: ['*.js'],
  extends: [js.configs.recommended]
};

const config = typegen(
  defineConfig([
    globalIgnores(['eslint-typegen.d.ts']),
    rootConfig,
    importsConfig,
    importsConfigFilesConfig,
    jsConfig,
    prettier
  ]),
  // ESLint 10 declares `Linter.RulesRecord` as a type alias, so the default
  // `declare module 'eslint'` augmentation can't merge; `RuleOptions` is
  // imported explicitly instead. Plugins listed here take their rule options
  // from their own typed rule modules rather than the JSON schema.
  {
    typedPlugins: [
      {
        name: 'import-x',
        rulesType: "typeof import('eslint-plugin-import-x').rules"
      }
    ]
  }
);

export default config;

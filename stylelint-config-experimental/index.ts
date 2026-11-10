import type { Config } from 'stylelint';

/**
 * Shareable config for experimental CSS. Extend it *after*
 * `stylelint-config-standard`: it re-declares the standard rules whose data
 * (css-tree / known-css-properties) lags behind browsers, adding an explicit
 * allowlist of experimental features instead of switching the rules off.
 * Every entry below should be removed once stylelint learns the feature.
 *
 * Features with their own syntax (`@function`, `@mixin`/`@apply`) are
 * validated by the `experimental/*` rules from `./plugin.ts`.
 */

// Matches any value; for properties stylelint has no value syntax for yet.
const ANY_VALUE = ['/.+/'];

/** Properties stylelint doesn't know at all (`property-no-unknown`). */
const UNKNOWN_PROPERTIES = [
  // CSS Fit 1
  'text-grow',
  'text-shrink',
  // CSS Grid 3 (grid lanes / masonry)
  'item-flow',
  'item-pack',
  'item-tolerance'
];

/** Known properties without value syntax data (`declaration-property-value-no-unknown`). */
const PROPERTIES_WITHOUT_VALUE_SYNTAX = [
  // CSS Animations 2 (trigger-based animations)
  'animation-trigger',
  'timeline-trigger',
  'timeline-trigger-name',
  // CSS Overflow 4
  'block-ellipsis'
];

const config: Config = {
  plugins: ['./plugin.ts'],
  rules: {
    // --- Native @function / @mixin -----------------------------------------
    // The core rules reject valid syntax (`returns <number>#`, local `--x`
    // variables, `result:` inside `@media`); the experimental/* rules below
    // validate the prelude and body instead.
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          // CSS Mixins
          'mixin',
          'apply',
          'contents',
          // CSS Conditional 5
          'when',
          'else'
        ]
      }
    ],
    'at-rule-prelude-no-invalid': [
      true,
      {
        ignoreAtRules: [
          // Kept from stylelint-config-recommended.
          'media',
          // Validated by experimental/function-at-rule-valid and mixin-valid.
          'function',
          'mixin',
          'apply',
          // CSS Extensions: `@custom-selector :--name selector-list;`
          'custom-selector',
          // CSS Conditional 5
          'when',
          'else'
        ]
      }
    ],
    'no-invalid-position-declaration': [
      true,
      { ignoreAtRules: ['function', 'mixin'] }
    ],
    // The experimental/ version skips @function and @mixin bodies.
    'at-rule-descriptor-no-unknown': null,
    'experimental/at-rule-descriptor-no-unknown': true,
    'experimental/function-at-rule-valid': true,
    'experimental/function-no-undefined': true,
    'experimental/mixin-valid': true,

    // --- Selectors ---------------------------------------------------------
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: [
          // CSS Overflow 5 (scroll markers)
          'target-current',
          'target-before',
          'target-after',
          // Selectors 4
          'target-within',
          'local-link',
          // HTML interest invokers
          'interest-source',
          'interest-target'
        ]
      }
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: [
          // CSS Multicol 2
          'column'
        ]
      }
    ],
    'selector-type-no-unknown': [
      true,
      {
        // Kept from stylelint-config-recommended.
        ignore: ['custom-elements'],
        // Direction keywords inside `::scroll-button(<direction>)` are parsed
        // as type selectors.
        ignoreTypes: [
          '/^(up|down|left|right|block-start|block-end|inline-start|inline-end|prev|next)$/'
        ]
      }
    ],

    // --- Properties --------------------------------------------------------
    'property-no-unknown': [true, { ignoreProperties: UNKNOWN_PROPERTIES }],
    // The experimental/ version skips declarations that call a @function.
    'declaration-property-value-no-unknown': null,
    'experimental/declaration-property-value-no-unknown': [
      true,
      {
        ignoreProperties: Object.fromEntries(
          [...UNKNOWN_PROPERTIES, ...PROPERTIES_WITHOUT_VALUE_SYNTAX].map(
            (property) => [property, ANY_VALUE]
          )
        )
      }
    ],

    // --- Media queries -----------------------------------------------------
    'media-feature-name-value-no-unknown': [
      true,
      {
        ignoreMediaFeatureNameValues: {
          // Navigation Controls
          'nav-controls': ANY_VALUE
        }
      }
    ]
  }
};

export default config;

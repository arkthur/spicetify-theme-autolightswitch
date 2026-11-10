import type { AtRule, ChildNode, Container, Declaration, Root } from 'postcss';
import stylelint, { type Rule, type RuleBase } from 'stylelint';

// Rules for experimental CSS (native `@function`, `@mixin`/`@apply`). Stylelint's
// core rules validate against css-tree data, which lags behind the spec, so they
// reject valid syntax such as `returns <number>#` or local custom properties.
// These rules validate that syntax instead of leaving it unchecked; see
// `index.ts` for the core rules they replace or relax.

const { createPlugin, utils } = stylelint;

const NAMESPACE = 'experimental';
const DASHED_IDENT = /^--[\w-]+$/;
const FUNCTION_CALL = /(?<![\w-])(--[\w-]+)\(/g;
// Conditional group rules may wrap declarations inside @function.
const CONDITIONAL_AT_RULES = new Set(['media', 'container', 'supports']);

type Reportable = AtRule | Declaration | ChildNode;

/** Builds a plugin from a rule body, attaching the metadata stylelint needs. */
const definePlugin = (
  shortName: string,
  build: (ruleName: string) => RuleBase
) => {
  const ruleName = `${NAMESPACE}/${shortName}`;
  const rule: Rule = Object.assign(build(ruleName), {
    ruleName,
    messages: utils.ruleMessages(ruleName, {}),
    meta: { url: '', fixable: false }
  });

  return createPlugin(ruleName, rule);
};

/** Splits on commas that are not nested inside (), [] or {}. */
const splitTopLevel = (input: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of input) {
    if ('([{'.includes(char)) depth++;
    else if (')]}'.includes(char)) depth--;

    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts;
};

const isBalanced = (input: string): boolean => {
  let depth = 0;

  for (const char of input) {
    if ('(['.includes(char)) depth++;
    else if (')]'.includes(char)) depth--;
    if (depth < 0) return false;
  }

  return depth === 0;
};

const parsePrelude = (prelude: string) => {
  const match = /^(--[\w-]+)\(([\s\S]*)\)\s*(?:returns\s+([\s\S]+?))?\s*$/.exec(
    prelude.trim()
  );

  return match ?
      { name: match[1] ?? '', params: match[2] ?? '', returns: match[3] }
    : undefined;
};

const collectDefinedFunctions = (root: Root): Set<string> => {
  const defined = new Set<string>();

  root.walkAtRules('function', (atRule) => {
    const name = /^\s*(--[\w-]+)/.exec(atRule.params)?.[1];

    if (name) defined.add(name);
  });

  return defined;
};

const functionAtRuleValid = definePlugin(
  'function-at-rule-valid',
  (ruleName) => (primary) => (root, result) => {
    const valid = utils.validateOptions(result, ruleName, { actual: primary });

    if (!valid) return;

    const warn = (node: Reportable, text: string) => {
      utils.report({
        ruleName,
        result,
        node,
        message: `${text} (${ruleName})`
      });
    };

    // Returns whether `result` is declared in the container (or nested blocks).
    const checkBody = (container: Container): boolean => {
      let hasResult = false;

      container.each((child) => {
        if (child.type === 'comment') return;

        if (child.type === 'decl') {
          if (child.prop.toLowerCase() === 'result') hasResult = true;
          else if (!child.prop.startsWith('--')) {
            warn(
              child,
              `Unexpected declaration "${child.prop}" in @function; only local custom properties and "result" are allowed`
            );
          }
          return;
        }

        if (
          child.type === 'atrule' &&
          CONDITIONAL_AT_RULES.has(child.name.toLowerCase())
        ) {
          if (checkBody(child)) hasResult = true;
          return;
        }

        warn(
          child,
          `Unexpected ${child.type === 'atrule' ? `@${child.name}` : child.type} in @function`
        );
      });

      return hasResult;
    };

    const checkParam = (atRule: AtRule, raw: string, seen: Set<string>) => {
      const param = raw.trim();
      const paramName = /^\S+/.exec(param)?.[0] ?? '';

      if (!DASHED_IDENT.test(paramName)) {
        warn(
          atRule,
          `Invalid @function parameter "${param}"; names must be dashed idents (--name)`
        );
        return;
      }

      if (seen.has(paramName)) {
        warn(atRule, `Duplicate @function parameter "${paramName}"`);
      }
      seen.add(paramName);

      const rest = param.slice(paramName.length).trim();
      const colon = rest.indexOf(':');
      const type = (colon === -1 ? rest : rest.slice(0, colon)).trim();

      if (!isBalanced(rest)) {
        warn(atRule, `Unbalanced brackets in @function parameter "${param}"`);
      }
      if (type.startsWith('<') && !/^<[\w-]+>[+#]?$/.test(type)) {
        warn(
          atRule,
          `Invalid type "${type}" for @function parameter "${paramName}"`
        );
      }
      if (colon !== -1 && rest.slice(colon + 1).trim() === '') {
        warn(
          atRule,
          `Missing default value for @function parameter "${paramName}"`
        );
      }
    };

    root.walkAtRules('function', (atRule) => {
      const parsed = parsePrelude(atRule.params);

      if (parsed) {
        const seen = new Set<string>();

        if (parsed.params.trim() !== '') {
          for (const raw of splitTopLevel(parsed.params)) {
            checkParam(atRule, raw, seen);
          }
        }

        if (parsed.returns !== undefined && !isBalanced(parsed.returns)) {
          warn(atRule, 'Unbalanced brackets in @function "returns" type');
        }
      } else {
        warn(
          atRule,
          'Invalid @function prelude; expected "--name(--param <type>, ...) returns <type>"'
        );
      }

      if (!atRule.nodes) {
        warn(atRule, '@function must have a body');
      } else if (!checkBody(atRule)) {
        warn(atRule, '@function is missing a "result" declaration');
      }
    });
  }
);

interface FunctionNoUndefinedOptions {
  ignoreFunctions?: (string | RegExp)[];
}

/** Flags `--name(...)` calls that have no matching @function in the file. */
const functionNoUndefined = definePlugin(
  'function-no-undefined',
  (ruleName) =>
    (primary: true, secondary?: FunctionNoUndefinedOptions) =>
    (root, result) => {
      const valid = utils.validateOptions(
        result,
        ruleName,
        { actual: primary },
        {
          actual: secondary,
          possible: {
            ignoreFunctions: [
              (value: unknown) =>
                typeof value === 'string' || value instanceof RegExp
            ]
          },
          optional: true
        }
      );

      if (!valid) return;

      const defined = collectDefinedFunctions(root);
      const ignored = secondary?.ignoreFunctions ?? [];

      root.walkDecls((decl) => {
        for (const match of decl.value.matchAll(FUNCTION_CALL)) {
          const name = match[1] ?? '';
          const isIgnored = ignored.some((entry) =>
            typeof entry === 'string' ? entry === name : entry.test(name)
          );

          if (defined.has(name) || isIgnored) continue;

          utils.report({
            ruleName,
            result,
            node: decl,
            word: name,
            message: `Unknown function "${name}()"; no matching @function in this file (${ruleName})`
          });
        }
      });
    }
);

interface MixinValidOptions {
  ignoreMixins?: (string | RegExp)[];
}

/**
 * Validates `@mixin --name(--param, --other: default) { ... }`, that
 * `@contents` is only used inside a mixin, and that `@apply --name` refers to a
 * mixin defined in the file.
 */
const mixinValid = definePlugin(
  'mixin-valid',
  (ruleName) =>
    (primary: true, secondary?: MixinValidOptions) =>
    (root, result) => {
      const valid = utils.validateOptions(
        result,
        ruleName,
        { actual: primary },
        {
          actual: secondary,
          possible: {
            ignoreMixins: [
              (value: unknown) =>
                typeof value === 'string' || value instanceof RegExp
            ]
          },
          optional: true
        }
      );

      if (!valid) return;

      const warn = (node: Reportable, text: string) => {
        utils.report({
          ruleName,
          result,
          node,
          message: `${text} (${ruleName})`
        });
      };

      const defined = new Set<string>();

      root.walkAtRules('mixin', (atRule) => {
        const match = /^(--[\w-]+)\s*(?:\(([\s\S]*)\))?$/.exec(
          atRule.params.trim()
        );

        if (!match) {
          warn(
            atRule,
            'Invalid @mixin prelude; expected "--name" or "--name(--param, --param: default)"'
          );
          return;
        }

        defined.add(match[1] ?? '');

        const params = (match[2] ?? '').trim();
        const seen = new Set<string>();

        for (const raw of params === '' ? [] : splitTopLevel(params)) {
          const param = raw.trim();
          const colon = param.indexOf(':');
          const name = (colon === -1 ? param : param.slice(0, colon)).trim();

          if (!DASHED_IDENT.test(name)) {
            warn(
              atRule,
              `Invalid @mixin parameter "${param}"; names must be dashed idents (--name)`
            );
          } else if (seen.has(name)) {
            warn(atRule, `Duplicate @mixin parameter "${name}"`);
          }
          seen.add(name);

          if (colon !== -1 && param.slice(colon + 1).trim() === '') {
            warn(
              atRule,
              `Missing default value for @mixin parameter "${name}"`
            );
          }
        }

        if (!atRule.nodes) warn(atRule, '@mixin must have a body');
      });

      const insideMixin = new Set<AtRule>();

      root.walkAtRules('mixin', (mixin) => {
        mixin.walkAtRules('contents', (contents) => {
          insideMixin.add(contents);
        });
      });

      root.walkAtRules('contents', (atRule) => {
        if (!insideMixin.has(atRule)) {
          warn(atRule, '@contents can only be used inside a @mixin');
        }
      });

      const ignored = secondary?.ignoreMixins ?? [];

      root.walkAtRules('apply', (atRule) => {
        const name = /^\s*(--[\w-]+)/.exec(atRule.params)?.[1];

        if (!name) {
          warn(atRule, 'Invalid @apply prelude; expected "--mixin-name"');
          return;
        }

        const isIgnored = ignored.some((entry) =>
          typeof entry === 'string' ? entry === name : entry.test(name)
        );

        if (!defined.has(name) && !isIgnored) {
          warn(
            atRule,
            `Unknown mixin "${name}"; no matching @mixin in this file`
          );
        }
      });
    }
);

/**
 * Runs a core rule on a copy of the file with some nodes removed, so it never
 * sees syntax it can't validate. The clone keeps `source`, so warnings still
 * point at the original positions.
 */
const wrapCoreRule =
  (
    coreRuleName:
      'at-rule-descriptor-no-unknown' | 'declaration-property-value-no-unknown',
    prune: (root: Root) => void
  ): RuleBase =>
  (primary, secondary, context) =>
  async (root, result) => {
    const coreRule = await stylelint.rules[coreRuleName];
    const filtered = root.clone();

    prune(filtered);
    await coreRule(
      primary as true,
      secondary as never,
      context
    )(filtered, result);
  };

/**
 * `@function` and `@mixin` bodies hold local custom properties rather than
 * descriptors.
 */
const atRuleDescriptorNoUnknown = definePlugin(
  'at-rule-descriptor-no-unknown',
  () =>
    wrapCoreRule('at-rule-descriptor-no-unknown', (root) => {
      root.walkAtRules(/^(function|mixin)$/, (atRule) => {
        atRule.remove();
      });
    })
);

/**
 * The value syntax of a property set from a user-defined function
 * (`width: --f(1)`) depends on the function's return type, which css-tree
 * can't know. The same goes for `var()` references to a custom property that
 * holds such a call, so those custom properties are dropped too, which makes
 * the core rule skip the unresolvable `var()`. `function-no-undefined` still
 * checks that the function exists.
 */
const declarationPropertyValueNoUnknown = definePlugin(
  'declaration-property-value-no-unknown',
  () =>
    wrapCoreRule('declaration-property-value-no-unknown', (root) => {
      root.walkDecls((decl) => {
        if (new RegExp(FUNCTION_CALL).test(decl.value)) decl.remove();
      });
    })
);

export default [
  functionAtRuleValid,
  functionNoUndefined,
  mixinValid,
  atRuleDescriptorNoUnknown,
  declarationPropertyValueNoUnknown
];

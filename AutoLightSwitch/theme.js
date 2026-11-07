// AutoLightSwitch
//
// 1. Rule patching: Spotify's own CSS rules are edited in place through the CSSOM, the same
//    way a DevTools edit works. Nothing is injected as a constructed stylesheet, so each
//    edited rule keeps its original position, @layer, specificity and nesting.
// 2. System theme: Spotify's embedded Chromium always reports prefers-color-scheme: dark, so
//    the OS theme is read from system-theme.txt ("light" / "dark"), which
//    SystemThemeWatcher.exe keeps up to date (see SystemThemeWatcher.cs). When that file is
//    missing, user.css falls back to the media query.
(function autoLightSwitch() {
  "use strict";

  const FN = "--invert-lightness";
  const THEME_FILE = new URL("system-theme.txt", document.baseURI).href;
  const POLL_MS = 2000;
  const MISSING_POLL_MS = 10000;

  // selector + ctx identify a stock rule; "set" holds the declarations to patch as [prop, newValue, stockValue?].
  // A declaration is only patched when its current value equals stockValue (default: newValue with
  // --invert-lightness() removed), so rules that changed in a Spotify update are skipped instead of being broken.
  // ctx lists the enclosing @layer / @supports blocks.
  //
  // Tokens like --background-base hold a dark-theme value (a hard-coded color) unless a class set assigns a plain
  // --spice-* color, which user.css has already inverted. Every definition of a token is tagged with a companion
  // flag (--alsw-spice-<token>: 1 for a plain --spice-* color, 0 otherwise), so the use sites know where the
  // value came from instead of guessing from its color. See tagDefinition().
  const TOKENS = ["--background-base", "--text-base", "--text-subdued"];
  const flagOf = (token) => "--alsw-spice-" + token.slice(2);
  const invertUnlessSpice = (token) =>
    `if(style(${flagOf(token)}: 1): var(${token}); else: --invert-lightness(var(${token})))`;
  const PATCHES = [
    { selector: ".encore-internal-color-text-subdued", ctx: ["layer:encore"], set: [["color", invertUnlessSpice("--text-subdued"), "var(--text-subdued)"]] },
    { selector: ".JhOTA2pevTUzQPJ7GJG0", ctx: [], set: [["box-shadow", "0 4px 60px --invert-lightness(#00000080)"]] },
    { selector: ".LayvZgU4ToYAIUl3mdij", ctx: [], set: [["color", "--invert-lightness(var(--header-text-color))"]] },
    { selector: ".J4_kkGYm5hjbZlztykxr", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-inactive))"]] },
    { selector: ".J4_kkGYm5hjbZlztykxr.SOT5gG00YqnGQ4uR7PwQ", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-active))"]] },
    { selector: ".J4_kkGYm5hjbZlztykxr.l_p6nU70V4sJ7XaycCp3:hover", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-active))"]] },
    { selector: ".J4_kkGYm5hjbZlztykxr.l_p6nU70V4sJ7XaycCp3", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-inactive))"]] },
    { selector: ".J4_kkGYm5hjbZlztykxr.y45YX8smwP4lW13IQulz:hover", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-active))"]] },
    { selector: ".J4_kkGYm5hjbZlztykxr.y45YX8smwP4lW13IQulz", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-inactive))"]] },
    { selector: ".LY7FQL7fwsfvvsefVIik", ctx: [], set: [["color", "--invert-lightness(var(--lyrics-color-inactive))"]] },
    { selector: ".Ii0P5lvVrAzHgsutQTVz", ctx: [], set: [["background-color", "--invert-lightness(var(--lyrics-color-background))"]] },
    { selector: ".Ke_cNZcH3Yvd2QEbgKJk:before", ctx: [], set: [["background", "linear-gradient(--invert-lightness(#000000d9) 0%,--invert-lightness(#000000bf) 15%,--invert-lightness(#000000a3) 25%,--invert-lightness(#00000082) 35%,--invert-lightness(#00000061) 45%,--invert-lightness(#00000042) 55%,--invert-lightness(#00000029) 65%,--invert-lightness(#00000017) 75%,--invert-lightness(#0000000a) 85%,--invert-lightness(#00000003) 93%,--invert-lightness(#0000) 100%)"]] },
    { selector: ".e-10860-legacy-button-primary:hover .e-10860-button-primary__inner", ctx: ["layer:encore"], set: [["background-color", "--invert-lightness(var(--background-highlight))"]] },
    { selector: ".e-10860-legacy-chip:hover>.e-10860-legacy-chip__inner.e-10860-legacy-chip__inner--selected", ctx: ["layer:encore"], set: [["background-color", "--invert-lightness(var(--background-highlight))"]] },
    { selector: ".e-10860-legacy-button-primary:active .e-10860-button-primary__inner", ctx: ["layer:encore"], set: [["background-color", "--invert-lightness(var(--background-press))"]] },
    { selector: ".e-10860-legacy-chip:active>.e-10860-legacy-chip__inner.e-10860-legacy-chip__inner--selected", ctx: ["layer:encore"], set: [["background-color", "--invert-lightness(var(--background-press))"]] },
    { selector: ".NMt6sLFwXdQoCRD6zzVJ", ctx: [], set: [["box-shadow", "0 8px 24px --invert-lightness(#00000080)"]] },
    { selector: ".view-homeShortcutsGrid-shortcut .view-homeShortcutsGrid-imageWrapper", ctx: [], set: [["box-shadow", "0 8px 24px --invert-lightness(#00000080)"]] },
    { selector: ".au3m86XLSnE_qCxesM2W", ctx: [], set: [["background", "linear-gradient(--invert-lightness(#0009) 46.75%,--invert-lightness(#0006) 63.5%,--invert-lightness(#0000001a) 83.72%,--invert-lightness(#0000) 97.91%)"]] },
    { selector: ".VQnzdNl0IS5KgfsKHo7T", ctx: [], set: [["background", "linear-gradient(--invert-lightness(#0000) 2.09%,--invert-lightness(#0000001a) 16.28%,--invert-lightness(#0006) 36.5%,--invert-lightness(#0009) 53.25%)"]] },
    { selector: ".D8uRyOobEAEuRXg_R43p", ctx: [], set: [["background", "--invert-lightness(#0000008a)"]] },
    { selector: ".SG9nWInDQN0E8DeXv197", ctx: [], set: [["background-color", "--invert-lightness(var(--background-base))"]] },
    { selector: ".hbNOZbHD3bPL3OcHQWNn", ctx: [], set: [["background-color", "--invert-lightness(var(--background-base))"], ["--color-from", "--invert-lightness(var(--background-base-min-contrast))"]] },
    { selector: ".nfBy1HoO33kgPOyEc3WZ", ctx: [], set: [["background", "linear-gradient(--invert-lightness(#0000) 0%, --invert-lightness(#00000080) 100%), var(--background-noise)"]] },
    { selector: ".venMPE3QitySGonlITLf", ctx: [], set: [["background", "linear-gradient(--invert-lightness(#0000) 0%, --invert-lightness(#0009) 100%), var(--background-noise)"]] },
    { selector: ".venMPE3QitySGonlITLf:after", ctx: ["supports:(color: lab(from red l 1 1% / calc(alpha + 0.1)))"], set: [["background-image", "linear-gradient(--invert-lightness(oklch(from var(--background-base) l c h)) 0%, --invert-lightness(oklch(from var(--background-base) l c h/70%)) 40%)"]] },
    { selector: ".main-entityHeader-shadow", ctx: [], set: [["box-shadow", "0 4px 60px --invert-lightness(#00000080)"]] },
    { selector: ".KVUEWo6P2nuTDO5g_Qar .c1fjuXENW9S3t_0ok5su", ctx: [], set: [["--carousel-start-chevron-gradient", "--invert-lightness(#121212b3)"], ["--carousel-end-chevron-gradient", "--invert-lightness(#121212b3)"]] },
    { selector: ".main-gridContainer-homepageWithCarousels .main-gridContainer-homepageContent", ctx: [], set: [["--carousel-start-chevron-gradient", "--invert-lightness(#121212b3)"], ["--carousel-end-chevron-gradient", "--invert-lightness(#121212b3)"]] },
    { selector: ".r8bczAWCEgb9_L0iyIcc", ctx: [], set: [["--color-from", "--invert-lightness(var(--background-base-70))"]] },
    { selector: ".IfBZ5VdI_2nwDMl4H6Yh", ctx: [], set: [["background-image", "linear-gradient(--invert-lightness(#0009) 0%, var(--background-base) 100%), var(--background-noise)"]] },
    { selector: ".main-topBar-background", ctx: [], set: [["background-color", "--invert-lightness(var(--background-base))"]] },
    { selector: ".main-topBar-overlay", ctx: [], set: [["background-color", "--invert-lightness(#0009)"]] },
    { selector: ".xCEkyVpabf3oVGmFQVej.dtglbjFWIMhmwHwayh7P:after", ctx: [], set: [["background-color", "--invert-lightness(#0009)"]] },
    { selector: ".kMaYBahSBLOnErF7DLR2", ctx: [], set: [["background-image", "linear-gradient(--invert-lightness(#0009) 0%, var(--background-base) 100%), var(--background-noise)"]] },
    { selector: ".NknVk8hYvXI6ovbE8Zj0.YWvtYcp4OVsd4WMPoZOq", ctx: [], set: [["background-color", "--invert-lightness(var(--lyrics-color-background))"]] },
    { selector: ".EsUNkZWFxKwc6fbKNfzW", ctx: [], set: [["background", "linear-gradient(--invert-lightness(oklch(18% 0 0/.85)) 0%,--invert-lightness(#0000) 30%)"]] },
    { selector: ".QIBjBaN3C9pj9bsrHAPv", ctx: [], set: [["background", "linear-gradient(to bottom, transparent 0% var(--npv-canvas-bottom-scrim-clear-end), --invert-lightness(oklch(18% 0 0/.8)) var(--npv-canvas-bottom-scrim-mid-stop), --invert-lightness(oklch(18% 0 0)) var(--npv-canvas-bottom-scrim-solid-stop))"]] },
    { selector: ".EDgXuV5wMChY7CX03Q8Z", ctx: [], set: [["background", "linear-gradient(--invert-lightness(oklch(18% 0 0/.63)) 0%,--invert-lightness(oklch(18% 0 0/.53)) 30% 70%,--invert-lightness(oklch(18% 0 0)) 95%)"]] },
    { selector: ".bqVl6oP9CHC70vAFzqf3", ctx: [], set: [["background-color", "--invert-lightness(#000000b3)"]] },
    { selector: ".Y3i0QVby7QVDsOh2l0_m", ctx: [], set: [["background-color", "--invert-lightness(#00000080)"]] },
    { selector: ".ArpdzWdgRW_8lwpikPGW", ctx: [], set: [["box-shadow", "0 6px 10px --invert-lightness(#0009)"]] },
    { selector: "@keyframes HMwEYfqJnNpFPPs0mEgw to", ctx: [], set: [["box-shadow", "0 6px 10px --invert-lightness(#0009)"]] },
    { selector: ".b2LKgxzAnfpFyHOk0oHI", ctx: [], set: [["background", "--invert-lightness(#202f72)"]] },
    { selector: ".l8RVrxnqg47P8Sq2lW7X", ctx: [], set: [["background-color", "--invert-lightness(#0000004d)"]] },
    { selector: ".e-10860-button-primary__inner", ctx: ["layer:encore"], set: [["background-color", invertUnlessSpice("--background-base"), "var(--background-base)"], ["color", invertUnlessSpice("--text-base"), "var(--text-base)"]] },
    { selector: ".f5IimFOcWI6VZcJ1ilua", ctx: [], set: [["background-color", "--invert-lightness(var(--background-base))"], ["--color-from", "--invert-lightness(var(--cinema-mode-bg-color-from))"], ["--color-to", "--invert-lightness(var(--cinema-mode-bg-color-to))"]] },
  ];

  // Nested rules added to a stock rule, for contextual overrides ("inside .X, invert"). A rule is only inserted
  // when the stock rule doesn't already contain one starting with the same selector.
  const NESTED = [
    { selector: "a:not([data-encore-id])", ctx: [], rule: "&.YKFf7aD7NQbSIyEGzTxe { color: --invert-lightness(var(--spice-text)); }" },
    { selector: ".encore-internal-color-text-base", ctx: ["layer:encore"], rule: ".RfCzM5zFPeG1MfeMLM4h & { color: --invert-lightness(var(--text-base)); }" },
  ];
  const nestedSelector = (rule) => rule.slice(0, rule.indexOf("{")).trim();

  const squash = (s) => s.replace(/\s+/g, "");
  // Encore classes embed an experiment number that changes between Spotify versions (e-10860-..., e-101040-...),
  // so any number matches. selectorText reports :before/:after as ::before/::after, so both spellings are unified.
  const normSelector = (s) =>
    s
      .replace(/\.e-\d+-/g, ".e-N-")
      .replace(/::(before|after|first-line|first-letter)/g, ":$1")
      .replace(/\s*([>+~,])\s*/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  const normValue = (s) => s.replace(/\s*([,()])\s*/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();
  const ctxKey = (ctx) => ctx.map(squash).join("|");

  const bySelector = new Map();
  const nestedBySelector = new Map();
  for (const [list, map] of [[PATCHES, bySelector], [NESTED, nestedBySelector]]) {
    for (const patch of list) {
      const key = normSelector(patch.selector);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(patch);
    }
  }

  // Removes every --invert-lightness(...) wrapper, keeping its argument.
  function unwrap(value) {
    let out = "";
    let i = 0;
    while (i < value.length) {
      const start = value.indexOf(FN + "(", i);
      if (start < 0) {
        out += value.slice(i);
        break;
      }
      out += value.slice(i, start);
      let depth = 1;
      let end = start + FN.length + 1;
      while (depth && end < value.length) {
        const ch = value[end++];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      out += unwrap(value.slice(start + FN.length + 1, end - 1));
      i = end;
    }
    return out;
  }

  const probe = document.createElement("div").style;
  function canonical(prop, value) {
    probe.removeProperty(prop);
    probe.setProperty(prop, value);
    return normValue(probe.getPropertyValue(prop) || value);
  }

  const stats = { patched: 0, skipped: [], tagged: 0, inline: 0, nested: 0 };

  // "1": the value is a plain --spice-* color (already light). A value that just forwards another token takes
  // that token's flag. Anything else (hex, rgba(), color-mix(), ...) is a dark-theme value: "0".
  function classify(value) {
    const v = value.trim();
    if (/^var\(\s*--spice-[\w-]+\s*\)$/.test(v)) return "1";
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*[,)]/);
    if (ref && TOKENS.includes(ref[1])) return `var(${flagOf(ref[1])})`;
    return "0";
  }

  const sameValue = (a, b) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

  // Tags a stock rule (class set) or an inline style that defines a token, in the same declaration block, so
  // the flag travels with the value through the cascade and is overridden together with it.
  function tagDefinition(style) {
    let changed = false;
    for (const token of TOKENS) {
      const flag = flagOf(token);
      const value = style.getPropertyValue(token);
      const current = style.getPropertyValue(flag);
      if (value) {
        const wanted = classify(value);
        if (!sameValue(current, wanted)) {
          style.setProperty(flag, wanted, style.getPropertyPriority(token));
          changed = true;
        }
      } else if (current) {
        style.removeProperty(flag);
        changed = true;
      }
    }
    return changed;
  }

  function patchDeclarations(rule, patch) {
    for (const [prop, wrapped, stock] of patch.set) {
      const current = rule.style.getPropertyValue(prop);
      if (!current || current.includes(FN)) continue;
      if (canonical(prop, stock ?? unwrap(wrapped)) !== canonical(prop, current)) {
        stats.skipped.push(`${patch.selector} { ${prop} }`);
        continue;
      }
      rule.style.setProperty(prop, wrapped, rule.style.getPropertyPriority(prop));
      if (rule.style.getPropertyValue(prop).includes(FN)) stats.patched++;
      else stats.skipped.push(`${patch.selector} { ${prop} } (rejected)`);
    }
  }

  function patchStyleRule(rule, ctx) {
    if (tagDefinition(rule.style)) stats.tagged++;
    const key = normSelector(rule.selectorText);
    const here = ctxKey(ctx);
    for (const patch of bySelector.get(key) || []) {
      if (ctxKey(patch.ctx) === here) patchDeclarations(rule, patch);
    }
    for (const patch of nestedBySelector.get(key) || []) {
      if (ctxKey(patch.ctx) !== here) continue;
      const selector = squash(nestedSelector(patch.rule));
      if (Array.from(rule.cssRules).some((r) => r.selectorText && squash(r.selectorText).includes(selector.replace(/&$/, "")))) continue;
      try {
        rule.insertRule(patch.rule, rule.cssRules.length);
        stats.nested++;
      } catch (error) {
        stats.skipped.push(`${patch.selector} { ${nestedSelector(patch.rule)} } (${error.message})`);
      }
    }
  }

  function contextOf(rule) {
    if (rule instanceof CSSLayerBlockRule) return "layer:" + rule.name;
    if (rule instanceof CSSSupportsRule) return "supports:" + rule.conditionText;
    return "group:" + rule.constructor.name + ":" + (rule.conditionText || rule.cssText.slice(0, 40));
  }

  // Keyframes are addressed as "@keyframes <name> <keyText>", e.g. "@keyframes abc to". Chrome reports
  // from/to as 0%/100%, so those are mapped back.
  const keyText = (text) => ({ "0%": "from", "100%": "to" })[text] || text;
  function patchKeyframes(rule, ctx) {
    const here = ctxKey(ctx);
    for (const frame of rule.cssRules) {
      const key = normSelector(`@keyframes ${rule.name} ${keyText(frame.keyText)}`);
      for (const patch of bySelector.get(key) || []) {
        if (ctxKey(patch.ctx) === here) patchDeclarations(frame, patch);
      }
    }
  }

  function walk(rules, ctx) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        patchStyleRule(rule, ctx);
      } else if (rule instanceof CSSKeyframesRule) {
        patchKeyframes(rule, ctx);
      } else if (rule.cssRules) {
        walk(rule.cssRules, ctx.concat(contextOf(rule)));
      }
    }
  }

  const seenSheets = new WeakSet();
  function patchSheet(sheet) {
    if (!sheet || seenSheets.has(sheet)) return;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      return;
    }
    seenSheets.add(sheet);
    walk(rules, []);
  }

  function watchLink(link) {
    if (link.sheet) {
      patchSheet(link.sheet);
    } else {
      link.addEventListener("load", () => patchSheet(link.sheet), { once: true });
    }
  }

  function startRulePatching() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(watchLink);
    Array.from(document.styleSheets).forEach(patchSheet);

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLLinkElement && node.rel === "stylesheet") {
            watchLink(node);
          } else if (node instanceof HTMLStyleElement) {
            queueMicrotask(() => patchSheet(node.sheet));
          }
        }
      }
    }).observe(document.head, { childList: true });

    startInlineTagging();

    // Inspect from DevTools: __autoLightSwitch.stats
    window.__autoLightSwitch = { stats, patchSheet, PATCHES };
  }

  // React redefines tokens through inline styles (style={{"--text-subdued": "#FFBDB4"}}). The same flag is
  // written next to the token in the element's style attribute, so the redefinition is tagged exactly like a
  // class set; the observer runs before the next paint.
  const INLINE_SELECTOR = TOKENS.map((token) => `[style*="${token}"]`).join(",");

  function tagInline(element) {
    const attr = element.getAttribute("style");
    if (!attr || !attr.includes("--")) return;
    if (tagDefinition(element.style)) stats.inline++;
  }

  function tagSubtree(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(INLINE_SELECTOR)) tagInline(node);
    node.querySelectorAll(INLINE_SELECTOR).forEach(tagInline);
  }

  function startInlineTagging() {
    tagSubtree(document.documentElement);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          tagInline(mutation.target);
        } else {
          mutation.addedNodes.forEach(tagSubtree);
        }
      }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  async function readSystemTheme() {
    try {
      const response = await fetch(`${THEME_FILE}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const value = (await response.text()).trim();
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function applyTheme(mode) {
    const root = document.documentElement;
    root.classList.toggle("alsw-light", mode === "light");
    root.classList.toggle("alsw-dark", mode === "dark");
  }

  async function pollSystemTheme() {
    const mode = await readSystemTheme();
    applyTheme(mode);
    setTimeout(pollSystemTheme, mode ? POLL_MS : MISSING_POLL_MS);
  }

  function start() {
    startRulePatching();
    pollSystemTheme();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

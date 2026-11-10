// AutoLightSwitch
//
// 1. Color inversion: every hard-coded color found in a stylesheet rule or in an inline style (including custom
//    property definitions such as --background-base: #e91429) is wrapped in --invert-lightness(). Rules are edited
//    in place through the CSSOM, the same way a DevTools edit works, so each edited rule keeps its original
//    position, @layer, specificity and nesting. Nothing is injected as a constructed stylesheet.
//    Colors that are already light or already inverted are never wrapped (see keepProperty and the skips below),
//    and every consumer of a wrapped definition inherits the inversion through var(), so use sites need no patch.
// 2. System theme: Spotify's embedded Chromium always reports prefers-color-scheme: dark, so
//    the OS theme is read from system-theme.txt ("light" / "dark"), which
//    SystemThemeWatcher.exe keeps up to date (see SystemThemeWatcher.cs). When that file is
//    missing, user.css falls back to the media query.
// 3. Theme switch: three buttons (light, system, dark) in the top bar, left of the "What's New" bell. Light and
//    dark are forced, system follows the Windows setting. The choice is kept in localStorage.
(function autoLightSwitch() {
  "use strict";

  const FN = "--invert-lightness";
  const THEME_FILE = new URL("system-theme.txt", document.baseURI).href;
  const POLL_MS = 2000;
  const MISSING_POLL_MS = 10000;

  const stats = { colors: 0, inlineColors: 0, skipped: [] };

  const COLOR_SRC =
    "(?<!--invert-lightness\\()(?:#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\\((?:(?!var\\()[^()])*\\))";
  const COLOR_RE = new RegExp(COLOR_SRC, "gi");
  // url(...) is matched first so that color-looking text inside it (svg#fragment) is left alone.
  const COLOR_OR_URL_RE = new RegExp(`url\\((?:"[^"]*"|'[^']*'|[^)]*)\\)|${COLOR_SRC}`, "gi");
  const wrapColors = (value) =>
    value.replace(COLOR_OR_URL_RE, (match) => (/^url\(/i.test(match) ? match : `${FN}(${match})`));

  // The --spice-* palette is rebuilt and inverted by user.css, and --alsw-* are the theme's own switches.
  // Colors containing var() (rgba(var(--spice-rgb-text), .3)) are never matched: they come from the palette.
  const keepProperty = (name) => name.startsWith("--spice-") || name.startsWith("--alsw-");

  // Rules scoped to Encore's light theme already hold light colors.
  const LIGHT_SCOPE_RE = /light-theme/;
  // The theme's own sheets define the palette the inversion starts from.
  const THEME_SHEET_RE = /\/(?:user|colors)\.css(?:[?#]|$)/;

  // Splits a declaration block on top-level semicolons (not inside (), "" or '').
  function splitDeclarations(text) {
    const out = [];
    let depth = 0;
    let quote = "";
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === ";" && depth === 0) {
        out.push(text.slice(start, i));
        start = i + 1;
      }
    }
    out.push(text.slice(start));
    return out.map((s) => s.trim()).filter(Boolean);
  }

  // The block is read back through cssText, which serializes shorthands (background, box-shadow, ...) as written,
  // so a shorthand is patched as a whole instead of through the longhands it expands to.
  function wrapHardcodedColors(rule, label) {
    const text = rule.style.cssText;
    if (text.search(COLOR_RE) < 0) return;
    for (const declaration of splitDeclarations(text)) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim();
      if (keepProperty(name)) continue;
      const important = /\s*!important$/i.test(declaration);
      const value = declaration.slice(colon + 1).replace(/\s*!important$/i, "").trim();
      const next = wrapColors(value);
      if (next === value) continue;
      rule.style.setProperty(name, next, important ? "important" : "");
      if (rule.style.getPropertyValue(name).includes(FN)) stats.colors++;
      else stats.skipped.push(`${label} { ${name} } (rejected)`);
    }
  }

  // wrap: false inside the theme's own sheets and light-theme scopes.
  function walk(rules, wrap) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const scoped = wrap && !LIGHT_SCOPE_RE.test(rule.selectorText);
        if (scoped) wrapHardcodedColors(rule, rule.selectorText);
        if (rule.cssRules.length) walk(rule.cssRules, scoped);
      } else if (rule instanceof CSSKeyframesRule) {
        if (!wrap) continue;
        for (const frame of rule.cssRules) wrapHardcodedColors(frame, `@keyframes ${rule.name} ${frame.keyText}`);
      } else if (typeof CSSNestedDeclarations !== "undefined" && rule instanceof CSSNestedDeclarations) {
        if (wrap) wrapHardcodedColors(rule, "(nested declarations)");
      } else if (typeof CSSFunctionRule !== "undefined" && rule instanceof CSSFunctionRule) {
        continue;
      } else if (rule.cssRules) {
        walk(rule.cssRules, wrap);
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
    walk(rules, !THEME_SHEET_RE.test(sheet.href || ""));
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

    startInlineInversion();

    // Inspect from DevTools: __autoLightSwitch.stats
    window.__autoLightSwitch = { stats, patchSheet, setMode: (next) => setMode(next) };
  }

  // React sets colors through inline styles, including custom properties (style={{"--text-subdued": "#FFBDB4"}})
  // and gradients (style="background-image: linear-gradient(rgba(0, 0, 0, 0.5), ...)"). The observer runs before
  // the next paint, and an already wrapped value is left alone, so rewriting the attribute can't loop.
  const INLINE_SELECTOR = "[style]";

  function invertInlineColors(style) {
    const updates = [];
    for (const prop of style) {
      if (keepProperty(prop)) continue;
      const value = style.getPropertyValue(prop);
      const next = wrapColors(value);
      if (next !== value) updates.push([prop, next, style.getPropertyPriority(prop)]);
    }
    for (const [prop, value, priority] of updates) style.setProperty(prop, value, priority);
    return updates.length > 0;
  }

  function invertInline(element) {
    if (!element.hasAttribute("style")) return;
    if (invertInlineColors(element.style)) stats.inlineColors++;
  }

  function invertSubtree(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(INLINE_SELECTOR)) invertInline(node);
    node.querySelectorAll(INLINE_SELECTOR).forEach(invertInline);
  }

  function startInlineInversion() {
    invertSubtree(document.documentElement);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          invertInline(mutation.target);
        } else {
          mutation.addedNodes.forEach(invertSubtree);
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

  // Light and dark are forced from the top bar switch; system follows the Windows setting read by readSystemTheme().
  const MODE_KEY = "autolightswitch:mode";
  const MODES = ["light", "system", "dark"];
  const MODE_LABELS = { light: "Light theme", system: "System theme", dark: "Dark theme" };
  const MODE_ICONS = {
    light:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  };

  function loadMode() {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      return MODES.includes(saved) ? saved : "system";
    } catch {
      return "system";
    }
  }

  let mode = loadMode();
  let systemTheme = null;
  let pollTimer = 0;

  // The theme in effect: the forced one, or the system's. null (system, no watcher) leaves the media query in charge.
  const effectiveTheme = () => (mode === "system" ? systemTheme : mode);

  function applyTheme() {
    const theme = effectiveTheme();
    const root = document.documentElement;
    root.classList.toggle("alsw-light", theme === "light");
    root.classList.toggle("alsw-dark", theme === "dark");
    for (const button of document.querySelectorAll(".alsw-mode-switch [data-mode]")) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    }
  }

  function setMode(next) {
    if (!MODES.includes(next) || next === mode) return;
    mode = next;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // The choice then only lasts until Spotify restarts.
    }
    applyTheme();
  }

  // Polling continues while a theme is forced, so that going back to "system" is instant.
  async function pollSystemTheme() {
    clearTimeout(pollTimer);
    systemTheme = await readSystemTheme();
    applyTheme();
    pollTimer = setTimeout(pollSystemTheme, systemTheme ? POLL_MS : MISSING_POLL_MS);
  }

  // The switch sits in the top bar, left of the "What's New" bell (the first child of .main-actionButtons). React
  // rebuilds that bar now and then, so it is put back whenever it goes missing.
  function createModeSwitch() {
    const group = document.createElement("div");
    group.className = "alsw-mode-switch";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Theme");
    for (const value of MODES) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.mode = value;
      button.title = MODE_LABELS[value];
      button.setAttribute("aria-label", MODE_LABELS[value]);
      button.setAttribute("aria-pressed", String(value === mode));
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MODE_ICONS[value]}</svg>`;
      button.addEventListener("click", () => setMode(value));
      group.append(button);
    }
    return group;
  }

  let modeSwitch = null;
  function ensureModeSwitch() {
    const bar = document.querySelector(".main-actionButtons");
    if (!bar) return;
    modeSwitch ??= createModeSwitch();
    if (bar.firstElementChild !== modeSwitch) bar.prepend(modeSwitch);
  }

  function startModeSwitch() {
    let queued = false;
    ensureModeSwitch();
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureModeSwitch();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Spotify hides the native menu and window buttons in some views (fullscreen, cinema mode) through
  // NativeAPI.setWindowButtonsVisibility(). user.css paints a plate behind them, so it has to know. Spicetify
  // loads after this script starts, hence the retries.
  function trackNativeButtons(attempt = 0) {
    const native = window.Spicetify?.Platform?.NativeAPI;
    if (!native?.setWindowButtonsVisibility) {
      if (attempt < 120) setTimeout(trackNativeButtons, 500, attempt + 1);
      return;
    }
    const original = native.setWindowButtonsVisibility.bind(native);
    native.setWindowButtonsVisibility = (visible) => {
      document.documentElement.classList.toggle("alsw-native-buttons-hidden", !visible);
      return original(visible);
    };
  }

  // The maximize glyph becomes the restore glyph while the window is maximized, and user.css outlines each shape.
  function trackMaximized() {
    const update = () =>
      document.documentElement.classList.toggle(
        "alsw-maximized",
        window.outerWidth >= screen.availWidth && window.outerHeight >= screen.availHeight,
      );
    update();
    window.addEventListener("resize", update);
  }

  function start() {
    applyTheme();
    startRulePatching();
    pollSystemTheme();
    startModeSwitch();
    trackNativeButtons();
    trackMaximized();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

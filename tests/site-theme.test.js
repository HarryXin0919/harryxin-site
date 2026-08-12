import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const entries = [
  { name: "Home", html: "index.html" },
  { name: "FindItem", html: "projects/finditem/index.html" },
  { name: "RLCard", html: "rlcard/index.html" },
  { name: "Research", html: "rlcard/research/index.html" },
];

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function openingTags(source, tagName) {
  return Array.from(source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi")), (match) => ({
    index: match.index,
    tag: match[0],
  }));
}

function relIncludes(tag, value) {
  return (attribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes(value);
}

function firstStyleIndex(html) {
  const indexes = [];
  const style = html.search(/<style\b/i);
  if (style >= 0) indexes.push(style);
  for (const { index, tag } of openingTags(html, "link")) {
    if (relIncludes(tag, "stylesheet")) indexes.push(index);
  }
  return Math.min(...indexes);
}

function lightBlock(css) {
  return css.match(/html\[data-theme=["']light["']\]\s*\{([\s\S]*?)\}/)?.[1] || "";
}

test("every public entry restores the shared theme before styles and exposes one accessible control", async () => {
  for (const entry of entries) {
    const html = await readFile(new URL(entry.html, root), "utf8");
    const styleIndex = firstStyleIndex(html);
    const prepaintIndex = html.indexOf("harryxin-theme");
    const toggle = openingTags(html, "button").find(({ tag }) => /\bdata-theme-toggle\b/i.test(tag))?.tag;
    const sharedScript = openingTags(html, "script").find(
      ({ tag }) => attribute(tag, "src") === "/assets/site-theme.js",
    )?.tag;

    assert.ok(Number.isFinite(styleIndex), `${entry.name} must include local CSS`);
    assert.ok(
      prepaintIndex >= 0 && prepaintIndex < styleIndex,
      `${entry.name} must restore harryxin-theme before CSS is parsed`,
    );
    assert.match(html.slice(prepaintIndex, styleIndex), /localStorage\.getItem\(/, `${entry.name} prepaint must read storage`);
    const prepaint = html.slice(prepaintIndex, styleIndex);
    assert.match(prepaint, /["']system["']/i, `${entry.name} must accept system theme mode`);
    assert.match(prepaint, /["']light["']/i, `${entry.name} must accept light theme mode`);
    assert.match(prepaint, /["']dark["']/i, `${entry.name} must accept dark theme mode`);
    assert.match(prepaint, /data-theme-mode/i, `${entry.name} must preserve mode separately from its resolved palette`);
    assert.match(prepaint, /data-theme/i, `${entry.name} must resolve an actual light or dark palette before CSS`);
    assert.match(html.slice(prepaintIndex, styleIndex), /prefers-color-scheme:\s*light/i, `${entry.name} must fall back to the system theme`);
    assert.doesNotMatch(html, /finditem-theme/, `${entry.name} must not keep a route-specific preference`);

    assert.ok(toggle, `${entry.name} theme toggle is missing`);
    assert.equal(attribute(toggle, "type"), "button", `${entry.name} toggle must not submit forms`);
    assert.ok(attribute(toggle, "aria-label"), `${entry.name} toggle needs an accessible label`);
    assert.equal(attribute(toggle, "aria-pressed"), "false", `${entry.name} toggle needs a deterministic initial state`);
    assert.ok(sharedScript, `${entry.name} must load the shared theme controller`);
    assert.match(sharedScript, /\bdefer\b/i, `${entry.name} shared controller must be deferred`);
  }
});

test("shared controller persists, synchronizes, and updates all theme-sensitive chrome", async () => {
  const source = await readFile(new URL("assets/site-theme.js", root), "utf8");

  assert.match(source, /harryxin-theme/);
  assert.match(source, /localStorage\.getItem\(/);
  assert.match(source, /localStorage\.setItem\(/);
  assert.match(source, /\[data-theme-toggle\]/);
  assert.match(source, /\[data-settheme\]/);
  assert.match(source, /data-theme-mode/);
  assert.match(source, /addEventListener\(["']click["']/);
  assert.match(source, /addEventListener\(["']storage["']/);
  assert.match(source, /addEventListener\(["']pageshow["']/);
  assert.match(source, /prefers-color-scheme:\s*light/);
  assert.match(source, /addEventListener\(["']change["']/);
  assert.match(source, /theme-color/);
  assert.match(source, /site-favicon/);
  assert.match(source, /data-logo-night/);
  assert.match(source, /data-theme-icon/);
  assert.doesNotMatch(source, /finditem-theme/);
});

test("shared controller keeps system mode separate from the resolved theme across every sync path", async () => {
  const source = await readFile(new URL("assets/site-theme.js", root), "utf8");
  const windowListeners = new Map();
  const mediaListeners = new Map();
  const storage = new Map([["harryxin-theme", "system"]]);

  function node(initial = {}) {
    const attributes = new Map(Object.entries(initial));
    const listeners = new Map();
    const classes = new Set();
    return {
      focusCount: 0,
      attributes,
      dataset: {},
      style: {},
      hidden: false,
      textContent: "",
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
        contains: (name) => classes.has(name),
      },
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (name === "data-theme") this.dataset.theme = String(value);
        if (name === "data-theme-mode") this.dataset.themeMode = String(value);
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      focus() {
        this.focusCount += 1;
      },
      dispatch(type, event = {}) {
        listeners.get(type)?.call(this, { currentTarget: this, preventDefault() {}, ...event });
      },
      querySelector(selector) {
        if (selector.includes("data-theme-label")) return this.label || null;
        if (selector.includes('data-theme-icon="moon"') || selector.includes("icon--moon")) return this.moon || null;
        if (selector.includes('data-theme-icon="sun"') || selector.includes("icon--sun")) return this.sun || null;
        return null;
      },
    };
  }

  const rootNode = node();
  const toggle = node({ "aria-pressed": "false" });
  const moon = node();
  const sun = node();
  const label = node();
  toggle.moon = moon;
  toggle.sun = sun;
  toggle.label = label;
  const choices = {
    system: node({ "data-settheme": "system", role: "radio", "aria-checked": "true", "aria-pressed": "true" }),
    light: node({ "data-settheme": "light", role: "radio", "aria-checked": "false", "aria-pressed": "false" }),
    dark: node({ "data-settheme": "dark", role: "radio", "aria-checked": "false", "aria-pressed": "false" }),
  };
  const themeColor = node({
    id: "theme-color",
    "data-theme-dark": "#080b0a",
    "data-theme-light": "#f3f5ef",
  });
  themeColor.dataset = { themeDark: "#080b0a", themeLight: "#f3f5ef" };
  const favicon = node({
    id: "site-favicon",
    href: "/night.svg",
    "data-theme-dark": "/night.svg",
    "data-theme-light": "/day.svg",
  });
  favicon.dataset = { themeDark: "/night.svg", themeLight: "/day.svg" };
  const brand = node({
    src: "/night-mark.svg",
    "data-logo-night": "/night-mark.svg",
    "data-logo-day": "/day-mark.svg",
  });
  brand.dataset = { logoNight: "/night-mark.svg", logoDay: "/day-mark.svg" };

  const document = {
    documentElement: rootNode,
    readyState: "complete",
    getElementById(id) {
      return id === "theme-color" ? themeColor : id === "site-favicon" ? favicon : null;
    },
    querySelector(selector) {
      if (selector.includes("theme-color")) return themeColor;
      if (selector.includes("site-favicon") || selector.includes("link")) return favicon;
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      if (selector.includes("data-theme-toggle")) return [toggle];
      if (selector.includes("data-settheme")) return Object.values(choices);
      if (selector.includes('data-theme-icon="moon"')) return [moon];
      if (selector.includes('data-theme-icon="sun"')) return [sun];
      if (selector.includes("data-theme-icon")) return [moon, sun];
      if (selector.includes("data-logo-night")) return [brand];
      if (selector.includes("data-theme-dark")) return [themeColor, favicon];
      return [];
    },
    addEventListener(type, callback) {
      windowListeners.set(`document:${type}`, callback);
    },
  };

  const media = {
    matches: false,
    addEventListener(type, callback) {
      mediaListeners.set(type, callback);
    },
    addListener(callback) {
      mediaListeners.set("change", callback);
    },
  };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const window = {
    document,
    localStorage,
    matchMedia: () => media,
    addEventListener(type, callback) {
      windowListeners.set(type, callback);
    },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout() {},
  };

  vm.runInNewContext(source, {
    window,
    document,
    localStorage,
    matchMedia: window.matchMedia,
    requestAnimationFrame: window.requestAnimationFrame,
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    console,
  });

  assert.equal(rootNode.dataset.themeMode, "system");
  assert.equal(rootNode.dataset.theme, "dark", "system mode should initially resolve from the OS");
  assert.equal(choices.system.getAttribute("aria-checked"), "true");
  assert.equal(choices.light.getAttribute("aria-checked"), "false");
  assert.equal(choices.dark.getAttribute("aria-checked"), "false");
  assert.equal(choices.system.getAttribute("tabindex"), "0");
  assert.equal(choices.light.getAttribute("tabindex"), "-1");
  assert.equal(choices.dark.getAttribute("tabindex"), "-1");

  media.matches = true;
  mediaListeners.get("change")?.({ matches: true });
  assert.equal(rootNode.dataset.themeMode, "system", "an OS change must not replace the selected mode");
  assert.equal(rootNode.dataset.theme, "light", "system mode must follow an OS change live");
  assert.equal(storage.get("harryxin-theme"), "system");
  assert.equal(themeColor.getAttribute("content"), "#f3f5ef");
  assert.equal(favicon.getAttribute("href"), "/day.svg");
  assert.equal(brand.getAttribute("src"), "/day-mark.svg");

  toggle.dispatch("click");
  assert.equal(rootNode.dataset.themeMode, "dark", "the legacy binary toggle must exit system mode");
  assert.equal(rootNode.dataset.theme, "dark", "the legacy toggle must switch away from the resolved daylight theme");
  assert.equal(storage.get("harryxin-theme"), "dark", "the legacy toggle must persist the explicit mode");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  assert.equal(choices.dark.getAttribute("aria-checked"), "true");

  media.matches = false;
  mediaListeners.get("change")?.({ matches: false });
  assert.equal(rootNode.dataset.theme, "dark", "OS changes must not override an explicit mode");

  choices.system.dispatch("click");
  assert.equal(storage.get("harryxin-theme"), "system");
  assert.equal(rootNode.dataset.themeMode, "system");
  assert.equal(rootNode.dataset.theme, "dark");
  assert.equal(choices.system.getAttribute("aria-checked"), "true");

  media.matches = true;
  mediaListeners.get("change")?.({ matches: true });
  assert.equal(rootNode.dataset.theme, "light");
  assert.equal(moon.style.display, "none", "resolved daylight must hide the moon SVG on iOS");
  assert.equal(sun.style.display, "block", "resolved daylight must show the sun SVG on iOS");

  windowListeners.get("storage")?.({ key: "harryxin-theme", newValue: "light" });
  assert.equal(rootNode.dataset.themeMode, "light", "another tab must update the selected mode");
  assert.equal(rootNode.dataset.theme, "light");
  assert.equal(choices.light.getAttribute("aria-checked"), "true");

  windowListeners.get("storage")?.({ key: "harryxin-theme", newValue: "not-a-mode" });
  assert.equal(rootNode.dataset.themeMode, "system", "an invalid synchronized value must safely fall back to system");
  assert.equal(rootNode.dataset.theme, "light");

  storage.set("harryxin-theme", "system");
  windowListeners.get("pageshow")?.({ persisted: true });
  assert.equal(rootNode.dataset.themeMode, "system", "BFCache restore must re-read the selected mode");
  assert.equal(rootNode.dataset.theme, "light");
  assert.equal(window.HXSiteTheme.current(), "light");
  assert.equal(window.HXSiteTheme.mode(), "system");

  let prevented = 0;
  choices.system.dispatch("keydown", { key: "ArrowLeft", preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 1, "an appearance arrow key must suppress native scrolling");
  assert.equal(choices.dark.focusCount, 1, "ArrowLeft should wrap from System to Night");
  assert.equal(storage.get("harryxin-theme"), "dark");
  assert.equal(rootNode.dataset.themeMode, "dark");
  assert.equal(choices.dark.getAttribute("aria-checked"), "true");
  assert.equal(choices.dark.getAttribute("tabindex"), "0");
  assert.equal(choices.system.getAttribute("tabindex"), "-1");

  choices.dark.dispatch("keydown", { key: "Home", preventDefault: () => { prevented += 1; } });
  assert.equal(choices.system.focusCount, 1, "Home should focus and select the first appearance option");
  assert.equal(rootNode.dataset.themeMode, "system");
  assert.equal(choices.system.getAttribute("tabindex"), "0");

  choices.system.dispatch("keydown", { key: "End", preventDefault: () => { prevented += 1; } });
  assert.equal(choices.dark.focusCount, 2, "End should focus and select the last appearance option");
  assert.equal(rootNode.dataset.themeMode, "dark");
  assert.equal(choices.dark.getAttribute("tabindex"), "0");
  assert.equal(prevented, 3);

  choices.dark.dispatch("keydown", { key: "Tab", preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 3, "unhandled keys must keep native keyboard behavior");
});

test("RLCard and Research ship paper-like daylight tokens and full-size controls", async () => {
  const [rlcard, research] = await Promise.all([
    readFile(new URL("rlcard/styles.css", root), "utf8"),
    readFile(new URL("rlcard/research/styles.css", root), "utf8"),
  ]);

  const rlcardLight = lightBlock(rlcard);
  const researchLight = lightBlock(research);
  assert.ok(rlcardLight, "RLCard daylight token block is missing");
  assert.ok(researchLight, "Research daylight token block is missing");
  for (const token of ["--base", "--panel", "--paper", "--signal", "--amber", "--cyan"]) {
    assert.match(rlcardLight, new RegExp(`${token}\\s*:`), `RLCard daylight must override ${token}`);
  }
  for (const token of ["--bg", "--bg-deep", "--panel", "--text", "--green", "--mint", "--amber"]) {
    assert.match(researchLight, new RegExp(`${token}\\s*:`), `Research daylight must override ${token}`);
  }
  for (const [name, css] of [["RLCard", rlcard], ["Research", research]]) {
    const toggleRule = css.match(/\.theme-toggle\s*\{([\s\S]*?)\}/)?.[1] || "";
    assert.match(toggleRule, /(?:min-)?width\s*:\s*44px/, `${name} toggle must be at least 44px wide`);
    assert.match(toggleRule, /(?:min-)?height\s*:\s*44px/, `${name} toggle must be at least 44px tall`);
  }
});

test("Home and FindItem theme controls also keep a 44px touch target", async () => {
  const [homepage, finditem] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("projects/finditem/index.html", root), "utf8"),
  ]);
  const homeRule = homepage.match(/\.theme-toggle\s*\{([\s\S]*?)\}/)?.[1] || "";
  const finditemRule = finditem.match(/\.nav-icon-btn\s*\{([\s\S]*?)\}/)?.[1] || "";
  assert.match(homeRule, /min-height\s*:\s*44px/, "Home theme control must be at least 44px tall");
  assert.match(finditemRule, /width\s*:\s*44px/, "FindItem theme control must be at least 44px wide");
  assert.match(finditemRule, /height\s*:\s*44px/, "FindItem theme control must be at least 44px tall");
});

test("theme rollout files contain no unresolved merge markers", async () => {
  const paths = [
    ...entries.map((entry) => entry.html),
    "assets/site-theme.js",
    "rlcard/styles.css",
    "rlcard/research/styles.css",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.doesNotMatch(source, /^(?:<{7}|={7}|>{7})(?:\s|$)/m, `${path} contains a merge marker`);
  }
});

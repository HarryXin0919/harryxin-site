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
    assert.match(
      html.slice(prepaintIndex, styleIndex),
      /(?:===\s*["']light["'][\s\S]{0,120}===\s*["']dark["']|!==\s*["']light["'][\s\S]{0,120}!==\s*["']dark["'])/i,
      `${entry.name} must validate light and dark values`,
    );
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

test("shared controller behavior follows click, storage, page restore, and system preference", async () => {
  const source = await readFile(new URL("assets/site-theme.js", root), "utf8");
  const windowListeners = new Map();
  const mediaListeners = new Map();
  const storage = new Map([["harryxin-theme", "dark"]]);

  function node(initial = {}) {
    const attributes = new Map(Object.entries(initial));
    const listeners = new Map();
    const classes = new Set();
    return {
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
      },
      removeAttribute(name) {
        attributes.delete(name);
      },
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      dispatch(type, event = {}) {
        listeners.get(type)?.({ currentTarget: this, preventDefault() {}, ...event });
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

  assert.equal(rootNode.dataset.theme, "dark");
  toggle.dispatch("click");
  assert.equal(rootNode.dataset.theme, "light", "click must switch to light");
  assert.equal(storage.get("harryxin-theme"), "light", "click must persist the choice");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.equal(moon.style.display, "none", "daylight mode must hide the moon SVG on iOS");
  assert.equal(sun.style.display, "block", "daylight mode must show the sun SVG on iOS");
  assert.equal(themeColor.getAttribute("content"), "#f3f5ef");
  assert.equal(favicon.getAttribute("href"), "/day.svg");
  assert.equal(brand.getAttribute("src"), "/day-mark.svg");

  windowListeners.get("storage")?.({ key: "harryxin-theme", newValue: "dark" });
  assert.equal(rootNode.dataset.theme, "dark", "another tab must update the page theme");

  storage.set("harryxin-theme", "light");
  windowListeners.get("pageshow")?.({ persisted: true });
  assert.equal(rootNode.dataset.theme, "light", "BFCache restore must re-read the preference");

  storage.delete("harryxin-theme");
  media.matches = false;
  mediaListeners.get("change")?.({ matches: false });
  assert.equal(rootNode.dataset.theme, "dark", "system changes must apply without a manual preference");
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

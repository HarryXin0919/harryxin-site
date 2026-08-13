import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function fakeNode(initial = {}) {
  const attributes = new Map(Object.entries(initial));
  const listeners = new Map();
  const classes = new Set();
  return {
    focusCount: 0,
    parentNode: null,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    addEventListener: (type, listener) => listeners.set(type, listener),
    focus() {
      this.focusCount += 1;
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.call(this, { currentTarget: this, preventDefault() {}, ...event });
    },
  };
}

test("Settings is an App-only screen with appearance, navigation preview, and language choices", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const settings = homepage.match(/<section\b[^>]*\bid=["']settings["'][^>]*>[\s\S]*?<\/section>/i)?.[0];
  assert.ok(settings, "Settings screen is missing");
  assert.equal(attribute(settings.match(/<section\b[^>]*>/i)[0], "data-app-screen"), "settings");
  assert.match(attribute(settings.match(/<section\b[^>]*>/i)[0], "class") || "", /\bapp-settings\b/);
  assert.match(settings, /<h2>[\s\S]*data-lang=["']en["']>Settings<[\s\S]*data-lang=["']zh["']>设置</);

  const back = settings.match(/<button\b[^>]*\bdata-app-settings-back\b[^>]*>/i)?.[0];
  assert.ok(back, "Settings needs its own back control");
  assert.equal(attribute(back, "type"), "button");
  assert.ok(attribute(back, "aria-label"));

  const groups = [...settings.matchAll(/<fieldset\b[^>]*\brole=["']radiogroup["'][^>]*>/gi)].map((match) => match[0]);
  assert.equal(groups.length, 3, "Appearance, Navigation Preview, and Language must be separate radio groups");
  for (const group of groups) assert.ok(attribute(group, "aria-label"), "each Settings group needs a name");

  const choiceTags = [...settings.matchAll(/<button\b[^>]*\bclass=["'][^"']*settings-choice[^"']*["'][^>]*>/gi)]
    .map((match) => match[0]);
  assert.equal(choiceTags.length, 7);
  for (const choice of choiceTags) {
    assert.equal(attribute(choice, "type"), "button");
    assert.equal(attribute(choice, "role"), "radio");
    assert.match(attribute(choice, "aria-checked") || "", /^(?:true|false)$/);
  }
  assert.deepEqual(
    choiceTags.filter((tag) => attribute(tag, "data-settheme")).map((tag) => attribute(tag, "data-settheme")),
    ["system", "light", "dark"],
  );
  assert.deepEqual(
    choiceTags.filter((tag) => attribute(tag, "data-setnav")).map((tag) => attribute(tag, "data-setnav")),
    ["tabs", "menu"],
  );
  assert.deepEqual(
    choiceTags.filter((tag) => attribute(tag, "data-setlang")).map((tag) => attribute(tag, "data-setlang")),
    ["en", "zh"],
  );
});

test("App chrome reserves iOS safe areas and never pins Settings over page content", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  assert.match(homepage, /\.app-settings-trigger,\.app-menu-trigger,\.app-menu-layer,\.app-settings\{display:none\}/);
  assert.match(
    homepage,
    /html\.app-mode \.topbar,\s*html\.app-mode\.is-scrolled \.topbar\{[\s\S]{0,120}position:relative;[\s\S]{0,40}top:auto/,
  );
  assert.match(homepage, /html\.app-mode body\{[\s\S]{0,80}min-height:100vh;[\s\S]{0,40}min-height:100svh;/);
  assert.match(
    homepage,
    /html\.app-mode \.wrap\{[\s\S]{0,240}safe-area-inset-right[\s\S]{0,120}safe-area-inset-left/,
    "safe-area padding must apply to the broad phone/iPad App shell",
  );
  assert.match(homepage, /html\.app-mode\[data-app-page="settings"\] \.topbar,[\s\S]{0,100}\.mobile-tabbar/);
  assert.match(homepage, /\.app-settings-trigger\{[\s\S]{0,100}width:44px;[\s\S]{0,40}height:44px/);
  assert.match(homepage, /\.app-menu-trigger\{[\s\S]{0,100}width:44px;[\s\S]{0,40}height:44px/);
  assert.match(homepage, /\.app-settings-back\{[\s\S]{0,100}width:44px;[\s\S]{0,40}height:44px/);
  assert.match(homepage, /\.settings-choice\{[\s\S]{0,180}min-height:56px/);
});

test("desktop and Settings language controls stay synchronized in both directions", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const marker = homepage.indexOf("/* ---------- language switch");
  const start = homepage.indexOf("  (function(){", marker);
  const end = homepage.indexOf("  })();", start);
  assert.ok(marker >= 0 && start > marker && end > start, "language controller block is missing");
  const source = homepage.slice(start, end + "  })();".length);
  assert.match(source, /querySelectorAll\('\[data-setlang\]'\)/);
  assert.doesNotMatch(source, /\.langsw button\[data-setlang\]/);

  const desktopEn = fakeNode({ "data-setlang": "en" });
  const desktopZh = fakeNode({ "data-setlang": "zh" });
  const settingsEn = fakeNode({ "data-setlang": "en", role: "radio" });
  const settingsZh = fakeNode({ "data-setlang": "zh", role: "radio" });
  const languageGroup = {
    querySelectorAll(selector) {
      assert.equal(selector, '[role="radio"][data-setlang]');
      return [settingsEn, settingsZh];
    },
  };
  settingsEn.parentNode = languageGroup;
  settingsZh.parentNode = languageGroup;
  const buttons = [desktopEn, desktopZh, settingsEn, settingsZh];
  const cover = fakeNode({
    src: "/cover-en.jpg",
    "data-cover-en": "/cover-en.jpg",
    "data-cover-zh": "/cover-zh.jpg",
  });
  const root = fakeNode();
  const storage = new Map([["lang", "en"]]);
  const windowListeners = new Map();
  const document = {
    querySelectorAll(selector) {
      if (selector === "[data-setlang]") return buttons;
      if (selector === "[data-cover-en][data-cover-zh]") return [cover];
      return [];
    },
  };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  const window = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
  };

  vm.runInNewContext(source, {
    document,
    localStorage,
    navigator: { language: "en-US" },
    root,
    window,
  });

  assert.equal(root.getAttribute("lang"), "en");
  assert.equal(settingsEn.getAttribute("aria-checked"), "true");
  assert.equal(settingsZh.getAttribute("aria-checked"), "false");
  assert.equal(settingsEn.getAttribute("tabindex"), "0");
  assert.equal(settingsZh.getAttribute("tabindex"), "-1");

  let prevented = 0;
  settingsEn.dispatch("keydown", { key: "ArrowLeft", preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 1, "a language arrow key must suppress native scrolling");
  assert.equal(settingsZh.focusCount, 1, "ArrowLeft should wrap from English to Chinese");
  assert.equal(root.getAttribute("lang"), "zh-Hans");
  assert.equal(storage.get("lang"), "zh");
  assert.equal(settingsEn.getAttribute("tabindex"), "-1");
  assert.equal(settingsZh.getAttribute("tabindex"), "0");

  settingsZh.dispatch("keydown", { key: "Home", preventDefault: () => { prevented += 1; } });
  assert.equal(settingsEn.focusCount, 1, "Home should focus and select English");
  assert.equal(root.getAttribute("lang"), "en");
  assert.equal(settingsEn.getAttribute("tabindex"), "0");
  assert.equal(settingsZh.getAttribute("tabindex"), "-1");

  settingsEn.dispatch("keydown", { key: "End", preventDefault: () => { prevented += 1; } });
  assert.equal(settingsZh.focusCount, 2, "End should focus and select Chinese");
  assert.equal(root.getAttribute("lang"), "zh-Hans");
  assert.equal(settingsZh.getAttribute("tabindex"), "0");
  assert.equal(prevented, 3);

  settingsZh.dispatch("keydown", { key: "Tab", preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 3, "unhandled keys must keep native keyboard behavior");

  settingsZh.dispatch("click");
  assert.equal(root.getAttribute("lang"), "zh-Hans");
  assert.equal(root.classList.contains("lang-zh"), true);
  assert.equal(storage.get("lang"), "zh");
  assert.equal(cover.getAttribute("src"), "/cover-zh.jpg");
  for (const button of [desktopZh, settingsZh]) assert.equal(button.getAttribute("aria-pressed"), "true");
  for (const button of [desktopEn, settingsEn]) assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(settingsZh.getAttribute("aria-checked"), "true");

  desktopEn.dispatch("click");
  assert.equal(root.getAttribute("lang"), "en");
  assert.equal(root.classList.contains("lang-en"), true);
  assert.equal(storage.get("lang"), "en");
  assert.equal(cover.getAttribute("src"), "/cover-en.jpg");
  assert.equal(settingsEn.getAttribute("aria-checked"), "true");

  storage.set("lang", "zh");
  windowListeners.get("storage")?.({ key: "lang", newValue: "zh" });
  assert.equal(root.getAttribute("lang"), "zh-Hans", "another tab must synchronize both control groups");
  assert.equal(settingsZh.getAttribute("aria-checked"), "true");
});

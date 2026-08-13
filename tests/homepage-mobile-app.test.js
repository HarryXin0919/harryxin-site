import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const primaryPageIds = ["home", "about", "creating", "now", "building"];
const appPageIds = [...primaryPageIds, "settings"];
const appMediaQuery = "(max-width: 820px), (any-pointer: coarse) and (max-width: 1400px)";

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
  };
}

function createElement({ tagName = "div", attributes = {}, heading = null } = {}) {
  const values = new Map(Object.entries(attributes));
  const listeners = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    parentNode: null,
    style: {},
    hidden: values.has("hidden"),
    inert: values.has("inert"),
    heading,
    getAttribute(name) {
      return values.has(name) ? values.get(name) : null;
    },
    setAttribute(name, value) {
      values.set(name, String(value));
      if (name === "hidden") this.hidden = true;
      if (name === "inert") this.inert = true;
    },
    removeAttribute(name) {
      values.delete(name);
      if (name === "hidden") this.hidden = false;
      if (name === "inert") this.inert = false;
    },
    hasAttribute(name) {
      return values.has(name);
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener.call(this, { currentTarget: this, preventDefault() {}, ...event });
    },
    querySelector(selector) {
      return selector === "h1,h2" ? heading : null;
    },
    querySelectorAll() {
      return [];
    },
    contains(candidate) {
      let current = candidate;
      while (current) {
        if (current === this) return true;
        current = current.parentNode;
      }
      return false;
    },
  };
  return element;
}

function createHeading() {
  const heading = createElement({ tagName: "h2" });
  heading.focusCount = 0;
  heading.focus = () => { heading.focusCount += 1; };
  return heading;
}

async function createAppHarness({ hash = "", mobile = true, navPreview = null, workScroll = null } = {}) {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const start = homepage.indexOf("  /* Wayfinding remains functional even when motion is reduced. */");
  const endMarker = "  /* HX_MOBILE_APP_ROUTER_END */";
  const end = homepage.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "mobile app router block is missing");
  const source = homepage.slice(start, end + endMarker.length);

  const documentListeners = new Map();
  const windowListeners = new Map();
  const mediaListeners = new Map();
  const frames = new Map();
  const historyPushes = [];
  const historyReplaces = [];
  const historyBacks = [];
  const scrollCalls = [];
  let nextFrameId = 1;

  const root = createElement({ tagName: "html" });
  root.classList = createClassList();
  root.scrollTop = 0;
  root.style = { scrollBehavior: "" };
  const topbar = createElement({ tagName: "div", attributes: { class: "topbar" } });
  topbar.getBoundingClientRect = () => ({ top: 8, bottom: 70, height: 62 });

  const screens = new Map(appPageIds.map((id) => [
    id,
    createElement({
      tagName: id === "home" ? "header" : "section",
      attributes: { id, "data-app-screen": id },
      heading: createHeading(),
    }),
  ]));
  const footer = createElement({
    tagName: "footer",
    attributes: { "data-app-screen-extra": "building" },
  });
  const tabs = new Map(primaryPageIds.map((id) => [
    id,
    createElement({
      tagName: "a",
      attributes: {
        href: `#${id}`,
        "data-app-tab": "",
        ...(id === "home" ? { "aria-current": "location" } : {}),
      },
    }),
  ]));
  const siteLinks = new Map(primaryPageIds.slice(1).map((id) => [
    id,
    createElement({ tagName: "a", attributes: { href: `#${id}` } }),
  ]));
  const sectionLinks = [...siteLinks.values(), ...tabs.values()];
  const settingsLink = createElement({
    tagName: "a",
    attributes: { href: "#settings", "data-app-settings-link": "" },
  });
  const settingsBack = createElement({
    tagName: "button",
    attributes: { type: "button", "data-app-settings-back": "" },
  });
  const workDetailLink = createElement({
    tagName: "a",
    attributes: { href: "/projects/viralens", "data-work-detail": "" },
  });
  const menuLinks = new Map(appPageIds.map((id) => [
    id,
    createElement({
      tagName: "a",
      attributes: {
        href: `#${id}`,
        "data-app-menu-item": "",
        ...(id === "settings" ? { "data-app-settings-link": "" } : {}),
        ...(id === "home" ? { "aria-current": "page" } : {}),
      },
    }),
  ]));
  const menuTrigger = createElement({
    tagName: "button",
    attributes: { type: "button", "data-app-menu-trigger": "", "aria-expanded": "false" },
  });
  const menuLayer = createElement({
    attributes: { "data-app-menu-layer": "", hidden: "", inert: "", "aria-hidden": "true" },
  });
  const menuDrawer = createElement({ attributes: { class: "app-menu-drawer" } });
  const menuClose = createElement({ tagName: "button", attributes: { type: "button", class: "app-menu-close", "data-app-menu-close": "" } });
  const navGroup = { querySelectorAll: () => navChoices };
  const navChoices = ["tabs", "menu"].map((mode) => {
    const choice = createElement({
      tagName: "button",
      attributes: { role: "radio", "data-setnav": mode },
    });
    choice.parentNode = navGroup;
    return choice;
  });
  menuDrawer.querySelectorAll = () => [menuClose, ...menuLinks.values()];
  menuClose.parentNode = menuDrawer;
  for (const link of menuLinks.values()) link.parentNode = menuDrawer;
  menuDrawer.parentNode = menuLayer;

  const location = { hash };
  const appMedia = {
    matches: mobile,
    addEventListener(type, listener) {
      if (!mediaListeners.has(type)) mediaListeners.set(type, []);
      mediaListeners.get(type).push(listener);
    },
    addListener(listener) {
      if (!mediaListeners.has("change")) mediaListeners.set("change", []);
      mediaListeners.get("change").push(listener);
    },
  };

  const document = {
    documentElement: root,
    body: { style: { overflow: "" } },
    activeElement: null,
    querySelectorAll(selector) {
      if (selector === '.site-nav a[href^="#"], .mobile-tabbar a[href^="#"]') return sectionLinks;
      if (selector === "[data-app-screen]") return [...screens.values()];
      if (selector === "[data-app-screen-extra]") return [footer];
      if (selector === "[data-setnav]") return navChoices;
      if (selector === "[data-app-menu-item]") return [...menuLinks.values()];
      return [];
    },
    querySelector(selector) {
      if (selector === ".topbar") return topbar;
      if (selector === "[data-app-menu-trigger]") return menuTrigger;
      if (selector === "[data-app-menu-layer]") return menuLayer;
      if (selector === ".app-menu-drawer") return menuDrawer;
      if (selector === ".app-menu-close") return menuClose;
      const match = selector.match(/^\[data-app-screen="([^"]+)"\]$/);
      return match ? screens.get(match[1]) || null : null;
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
  };
  for (const element of [...screens.values(), footer, ...sectionLinks, settingsLink, settingsBack, workDetailLink, menuTrigger, menuLayer]) {
    element.parentNode = document;
  }
  for (const element of [menuTrigger, menuClose, ...menuLinks.values(), ...navChoices]) {
    element.focusCount = 0;
    element.focus = () => {
      element.focusCount += 1;
      document.activeElement = element;
    };
  }

  const requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  };
  const cancelAnimationFrame = (id) => frames.delete(id);
  const window = {
    __hxAppBootFailSafe: null,
    location,
    pageYOffset: 0,
    history: {
      state: null,
      pushState(state, title, url) {
        historyPushes.push({ state, title, url });
        this.state = state;
        const index = url.indexOf("#");
        location.hash = index >= 0 ? url.slice(index) : "";
      },
      replaceState(state, title, url) {
        historyReplaces.push({ state, title, url });
        this.state = state;
        const index = url.indexOf("#");
        location.hash = index >= 0 ? url.slice(index) : "";
      },
      back() {
        historyBacks.push({ state: this.state, hash: location.hash });
      },
    },
    matchMedia(query) {
      assert.equal(query, appMediaQuery);
      return appMedia;
    },
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
    scrollTo(x, y) {
      scrollCalls.push([x, y]);
      this.pageYOffset = y;
      root.scrollTop = y;
    },
    setTimeout(callback) {
      return requestAnimationFrame(callback);
    },
    requestAnimationFrame,
    cancelAnimationFrame,
  };
  const sessionValues = new Map();
  if (navPreview !== null) sessionValues.set("harryxin-nav-preview", navPreview);
  if (workScroll !== null) sessionValues.set("harryxin-work-scroll", String(workScroll));
  const sessionStorage = {
    getItem: (key) => sessionValues.get(key) ?? null,
    setItem: (key, value) => sessionValues.set(key, String(value)),
    removeItem: (key) => sessionValues.delete(key),
  };

  vm.runInContext(source, vm.createContext({
    cancelAnimationFrame,
    clearTimeout: () => undefined,
    document,
    requestAnimationFrame,
    root,
    sessionStorage,
    window,
  }));

  const flushFrames = () => {
    while (frames.size) {
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pending) callback();
    }
  };
  const dispatchDocument = (type, event) => {
    for (const listener of documentListeners.get(type) || []) listener(event);
  };
  const dispatchWindow = (type, event = { type }) => {
    for (const listener of windowListeners.get(type) || []) listener(event);
  };
  const click = (id, target = tabs.get(id)) => {
    const event = {
      target,
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    dispatchDocument("click", event);
    return event;
  };
  const setScroll = (value) => {
    window.pageYOffset = value;
    root.scrollTop = value;
    dispatchWindow("scroll");
  };
  const setMobile = (value) => {
    appMedia.matches = value;
    for (const listener of mediaListeners.get("change") || []) listener({ matches: value });
  };

  return {
    appMedia,
    click,
    dispatchDocument,
    dispatchWindow,
    flushFrames,
    footer,
    historyBacks,
    historyPushes,
    historyReplaces,
    location,
    menuClose,
    menuDrawer,
    menuLayer,
    menuLinks,
    menuTrigger,
    navChoices,
    root,
    screens,
    scrollCalls,
    setMobile,
    setScroll,
    settingsBack,
    settingsLink,
    sessionValues,
    siteLinks,
    tabs,
    topbar,
    window,
    workDetailLink,
  };
}

function assertPartState(part, visible, description) {
  assert.equal(part.hidden, !visible, `${description} hidden state is wrong`);
  assert.equal(part.inert, !visible, `${description} inert property is wrong`);
  assert.equal(part.hasAttribute("hidden"), !visible, `${description} hidden attribute is wrong`);
  assert.equal(part.hasAttribute("inert"), !visible, `${description} inert attribute is wrong`);
  assert.equal(part.getAttribute("aria-hidden"), visible ? null : "true", `${description} aria-hidden state is wrong`);
}

function assertActivePage(harness, activeId) {
  assert.equal(harness.root.classList.contains("app-mode"), true);
  assert.equal(harness.root.getAttribute("data-app-page"), activeId);
  for (const id of appPageIds) {
    assertPartState(harness.screens.get(id), id === activeId, `${id} screen`);
  }
  for (const id of primaryPageIds) {
    assert.equal(
      harness.tabs.get(id).getAttribute("aria-current"),
      id === activeId ? "page" : null,
      `${id} tab current-page state is wrong`,
    );
  }
  for (const id of appPageIds) {
    assert.equal(
      harness.menuLinks.get(id).getAttribute("aria-current"),
      id === activeId ? "page" : null,
      `${id} menu item current-page state is wrong`,
    );
  }
  assertPartState(harness.footer, activeId === "building", "Work footer");
}

test("mobile app markup exposes six ordered screens but only five primary tabs", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const screenTags = Array.from(
    homepage.matchAll(/<(?:header|section)\b[^>]*\bdata-app-screen=(['"])(.*?)\1[^>]*>/gi),
    (match) => ({ id: match[2], tag: match[0] }),
  );
  assert.deepEqual(screenTags.map(({ id }) => id), appPageIds);
  for (const { id, tag } of screenTags) {
    assert.equal(attribute(tag, "id"), id, `${id} screen id must match its app route`);
    if (id !== "settings") {
      assert.doesNotMatch(tag, /\s(?:hidden|inert)(?=\s|=|>)/i, `${id} must remain visible in the desktop/no-JS source`);
      assert.equal(attribute(tag, "aria-hidden"), null, `${id} must not be hidden in the source`);
    } else {
      assert.match(attribute(tag, "class") || "", /\bapp-settings\b/, "Settings must remain an App-only screen");
    }
  }

  const tabbar = homepage.match(/<nav class="mobile-tabbar"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(tabbar, "mobile tabbar is missing");
  const tabTags = Array.from(tabbar.matchAll(/<a\b[^>]*\bdata-app-tab\b[^>]*>/gi), (match) => match[0]);
  assert.deepEqual(tabTags.map((tag) => attribute(tag, "href")), primaryPageIds.map((id) => `#${id}`));

  const settingsLink = homepage.match(/<a\b[^>]*\bdata-app-settings-link\b[^>]*>/i)?.[0];
  const settingsBack = homepage.match(/<button\b[^>]*\bdata-app-settings-back\b[^>]*>/i)?.[0];
  assert.ok(settingsLink, "App Settings trigger is missing");
  assert.equal(attribute(settingsLink, "href"), "#settings");
  assert.ok(attribute(settingsLink, "aria-label"), "App Settings trigger needs an accessible name");
  assert.ok(settingsBack, "App Settings back control is missing");
  assert.equal(attribute(settingsBack, "type"), "button");
  assert.ok(attribute(settingsBack, "aria-label"), "App Settings back control needs an accessible name");
});

test("Navigation Preview exposes five-page Tab Bar and Menu variants without creating a sixth primary page", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  assert.match(homepage, /harryxin-nav-preview/);
  assert.match(homepage, /sessionStorage\.getItem\('harryxin-nav-preview'\) \|\| 'tabs'/);
  assert.match(homepage, /if \(navPreview !== 'tabs' && navPreview !== 'menu'\) navPreview = 'tabs'/);

  const trigger = homepage.match(/<button\b[^>]*\bdata-app-menu-trigger\b[^>]*>/i)?.[0];
  assert.ok(trigger, "Menu mode needs a top-right trigger");
  assert.equal(attribute(trigger, "type"), "button");
  assert.equal(attribute(trigger, "aria-expanded"), "false");
  assert.equal(attribute(trigger, "aria-controls"), "app-menu-drawer");
  assert.ok(attribute(trigger, "aria-label"));

  const layer = homepage.match(/<div\b[^>]*\bdata-app-menu-layer\b[^>]*>[\s\S]*?<\/aside>\s*<\/div>/i)?.[0];
  assert.ok(layer, "Menu drawer layer is missing");
  assert.match(layer.match(/<aside\b[^>]*>/i)?.[0] || "", /\brole=["']dialog["']/i);
  assert.match(layer.match(/<aside\b[^>]*>/i)?.[0] || "", /\baria-modal=["']true["']/i);
  const menuItems = [...layer.matchAll(/<a\b[^>]*\bdata-app-menu-item\b[^>]*>/gi)].map((match) => match[0]);
  assert.deepEqual(menuItems.map((tag) => attribute(tag, "href")), appPageIds.map((id) => `#${id}`));
  assert.equal(menuItems.filter((tag) => /\bdata-app-settings-link\b/i.test(tag)).length, 1);

  assert.match(homepage, /html\.app-mode\[data-app-nav="menu"\]/i);
  assert.match(homepage, /html\.app-mode\[data-app-nav="menu"\] \.app-menu-trigger\{display:grid\}/);
  assert.match(homepage, /html\.app-mode\[data-app-nav="menu"\]\.app-menu-open \.app-menu-layer:not\(\[hidden\]\)\{pointer-events:auto\}/);
  assert.match(homepage, /\.mobile-tabbar a>span\{[\s\S]{0,100}font:650 10px\/1/);
  assert.match(homepage, /\.app-menu-drawer\{[\s\S]{0,340}safe-area-inset-top[\s\S]{0,180}safe-area-inset-right[\s\S]{0,180}safe-area-inset-bottom/);
});

test("Navigation Preview is session-scoped, keyboard-selectable, and defaults to Tab Bar", async () => {
  const harness = await createAppHarness();
  assert.equal(harness.root.getAttribute("data-app-nav"), "tabs");
  assert.equal(harness.navChoices[0].getAttribute("aria-checked"), "true");
  assert.equal(harness.navChoices[1].getAttribute("aria-checked"), "false");

  harness.navChoices[1].dispatch("click");
  assert.equal(harness.root.getAttribute("data-app-nav"), "menu");
  assert.equal(harness.sessionValues.get("harryxin-nav-preview"), "menu");
  assert.equal(harness.navChoices[1].getAttribute("tabindex"), "0");

  let prevented = 0;
  harness.navChoices[1].dispatch("keydown", {
    key: "ArrowRight",
    preventDefault: () => { prevented += 1; },
  });
  assert.equal(prevented, 1);
  assert.equal(harness.root.getAttribute("data-app-nav"), "tabs", "ArrowRight should wrap Menu to Tab Bar");
  assert.equal(harness.sessionValues.get("harryxin-nav-preview"), "tabs");
  assert.equal(harness.navChoices[0].focusCount, 1);

  const restored = await createAppHarness({ navPreview: "menu" });
  assert.equal(restored.root.getAttribute("data-app-nav"), "menu");
  assert.equal(restored.navChoices[1].getAttribute("aria-checked"), "true");
});

test("Menu drawer traps focus, closes with Escape, and returns focus to its trigger", async () => {
  const harness = await createAppHarness({ navPreview: "menu" });
  harness.menuTrigger.focus();
  const opened = harness.click("menu-open", harness.menuTrigger);
  assert.equal(opened.defaultPrevented, true);
  assert.equal(harness.root.classList.contains("app-menu-open"), true);
  assert.equal(harness.menuTrigger.getAttribute("aria-expanded"), "true");
  assert.equal(harness.menuLayer.hidden, false);
  assert.equal(harness.menuLayer.inert, false);
  assert.equal(harness.window.pageYOffset, 0);
  harness.flushFrames();
  assert.equal(harness.menuClose.focusCount, 1, "opening the drawer should focus its close control");

  let trapped = 0;
  harness.dispatchDocument("keydown", {
    key: "Tab",
    shiftKey: true,
    preventDefault: () => { trapped += 1; },
  });
  assert.equal(trapped, 1);
  assert.equal(harness.menuLinks.get("settings").focusCount, 1, "Shift+Tab from the first control must wrap to the last");

  let escaped = 0;
  harness.dispatchDocument("keydown", {
    key: "Escape",
    preventDefault: () => { escaped += 1; },
    stopPropagation() {},
  });
  assert.equal(escaped, 1);
  assert.equal(harness.root.classList.contains("app-menu-open"), false);
  assert.equal(harness.menuTrigger.getAttribute("aria-expanded"), "false");
  assert.equal(harness.menuLayer.getAttribute("aria-hidden"), "true");
  assert.equal(harness.menuLayer.inert, true);
  assert.equal(harness.menuTrigger.focusCount, 2, "closing the drawer should return focus to its trigger");
});

test("Menu items use the same App history, screen activation, and scroll state as Tab Bar items", async () => {
  const harness = await createAppHarness({ hash: "#about", navPreview: "menu" });
  harness.flushFrames();
  harness.setScroll(164);
  harness.menuTrigger.focus();
  harness.click("menu-open", harness.menuTrigger);
  harness.flushFrames();

  const selected = harness.click("building", harness.menuLinks.get("building"));
  assert.equal(selected.defaultPrevented, true);
  assert.equal(harness.historyPushes.length, 1);
  assert.equal(harness.historyPushes[0].state.appPage, "building");
  assert.equal(harness.historyPushes[0].title, "");
  assert.equal(harness.historyPushes[0].url, "#building");
  assertActivePage(harness, "building");
  assert.equal(harness.root.classList.contains("app-menu-open"), false);
  assert.equal(harness.menuLayer.getAttribute("aria-hidden"), "true");
  harness.flushFrames();
  assert.equal(harness.screens.get("building").heading.focusCount, 1);

  harness.click("about", harness.menuLinks.get("about"));
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 164]);
});

test("reselecting the current Menu page closes the drawer and restores focus", async () => {
  const harness = await createAppHarness({ hash: "#about", navPreview: "menu" });
  harness.flushFrames();
  harness.menuTrigger.focus();
  harness.click("menu-open", harness.menuTrigger);
  harness.flushFrames();

  const selected = harness.click("about", harness.menuLinks.get("about"));
  assert.equal(selected.defaultPrevented, true);
  assert.equal(harness.root.classList.contains("app-menu-open"), false);
  assert.equal(harness.menuLayer.inert, true);
  assert.equal(harness.menuTrigger.focusCount, 2, "focus must leave the inert drawer and return to its trigger");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
});

test("Work detail navigation survives a non-bfcache return with its scroll intact", async () => {
  const leaving = await createAppHarness({ hash: "#building" });
  leaving.flushFrames();
  leaving.setScroll(386);
  const detailClick = leaving.click("detail", leaving.workDetailLink);
  assert.equal(detailClick.defaultPrevented, false, "detail navigation must remain immediate on App devices");
  assert.equal(leaving.sessionValues.get("harryxin-work-scroll"), "386");

  const restored = await createAppHarness({ hash: "#building", workScroll: 386 });
  restored.flushFrames();
  assertActivePage(restored, "building");
  assert.deepEqual(restored.scrollCalls.at(-1), [0, 386]);
  assert.equal(restored.sessionValues.has("harryxin-work-scroll"), false, "the handoff offset must be consumed once");
  restored.dispatchWindow("load");
  restored.flushFrames();
  assert.deepEqual(restored.scrollCalls.at(-1), [0, 386], "load settling must not erase a restored Work position");
});

test("a bfcache Work return consumes the pending handoff before a later reload", async () => {
  const harness = await createAppHarness({ hash: "#building" });
  harness.flushFrames();
  harness.setScroll(244);
  harness.click("detail", harness.workDetailLink);
  assert.equal(harness.sessionValues.get("harryxin-work-scroll"), "244");

  harness.dispatchWindow("pageshow", { type: "pageshow", persisted: true });
  assert.equal(harness.sessionValues.has("harryxin-work-scroll"), false);
});

test("App mode covers phones and iPads without capturing a fine-only desktop", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const escapedJsQuery = appMediaQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cssQuery = "@media (max-width:820px), (any-pointer:coarse) and (max-width:1400px)";

  assert.equal((homepage.match(new RegExp(escapedJsQuery, "g")) || []).length, 2);
  assert.ok(homepage.split(cssQuery).length - 1 >= 4, "App shell CSS must use the iPad-aware media query");
  assert.match(homepage, /width:min\(720px,calc\(100% - 24px/);
  assert.match(homepage, /html\.app-mode \.wrap\{width:min\(1080px,calc\(100% - 48px\)\)\}/);
  assert.match(homepage, /html\.app-mode \.facts\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(homepage, /\.mobile-tabbar a\{[\s\S]{0,220}min-height:56px/);
  assert.match(homepage, /html\.app-mode body\{[\s\S]{0,80}min-height:100vh;[\s\S]{0,40}min-height:100svh;/);
  assert.match(
    homepage,
    /html\.app-mode \.wrap\{[\s\S]{0,240}safe-area-inset-right[\s\S]{0,120}safe-area-inset-left/,
    "the full phone/iPad App shell must reserve both horizontal safe areas",
  );
  assert.match(
    homepage,
    /html\.app-mode \.topbar,\s*html\.app-mode\.is-scrolled \.topbar\{[\s\S]{0,120}position:relative;[\s\S]{0,40}top:auto/,
    "App chrome must scroll in normal flow instead of covering the active screen",
  );
  assert.match(homepage, /html\.app-mode \.app-settings-trigger\{[\s\S]{0,100}width:44px;[\s\S]{0,40}height:44px/);
  assert.match(homepage, /\.app-settings-back\{[\s\S]{0,100}width:44px;[\s\S]{0,40}height:44px/);
  assert.match(homepage, /html\.app-mode\[data-app-page="settings"\] \.mobile-tabbar/);
  assert.match(homepage, /html\.app-mode:not\(\[data-app-direction\]\) \[data-app-screen\]:not\(\[hidden\]\)\{\s*animation:hx-app-launch-screen/);
  assert.match(homepage, /html\.app-mode \[data-app-screen\]:not\(\[hidden\]\)\{[\s\S]{0,220}animation:hx-app-page-switch-in/);
  assert.match(homepage, /html\.app-mode:not\(\[data-app-direction\]\) \.topbar\{\s*animation:hx-app-launch-topbar/);
  assert.match(homepage, /html\.app-mode:not\(\[data-app-direction\]\) \.mobile-tabbar\{\s*animation:hx-app-launch-tabbar/);
  assert.match(homepage, /html\.app-mode \[data-app-screen\] \.rise\{[\s\S]{0,180}animation:none!important/);
  for (const name of [
    "hx-app-page-switch-in",
    "hx-app-launch-topbar",
    "hx-app-launch-screen",
    "hx-app-launch-tabbar",
    "hx-app-launch-mark",
    "hx-app-launch-signal",
  ]) {
    assert.match(homepage, new RegExp(`@keyframes ${name}\\{`), `${name} keyframes are missing`);
  }
  assert.match(
    homepage,
    /if \(motionRoot\.classList\.contains\('app-mode'\)\) \{[\s\S]{0,180}motionRoot\.classList\.add\('motion-enabled'\);[\s\S]{0,80}return;/,
    "App first paint must bypass the desktop signal-lock preload",
  );

  const matchesAppMode = ({ width, coarse }) => width <= 820 || (coarse && width <= 1400);
  const cases = [
    { width: 768, coarse: false, expected: true },
    { width: 820, coarse: false, expected: true },
    { width: 821, coarse: false, expected: false },
    { width: 1024, coarse: true, expected: true },
    { width: 1180, coarse: true, expected: true },
    { width: 1194, coarse: true, expected: true },
    { width: 1376, coarse: true, expected: true },
    { width: 1400, coarse: true, expected: true },
    { width: 1401, coarse: true, expected: false },
    { width: 1024, coarse: false, expected: false },
    { width: 1194, coarse: false, expected: false },
    { width: 1366, coarse: false, expected: false },
    { width: 1440, coarse: true, expected: false },
  ];
  for (const sample of cases) {
    assert.equal(matchesAppMode(sample), sample.expected, `unexpected App mode at ${sample.width}px`);
  }
});

test("routed App headings keep a visible focus indicator", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  assert.match(
    homepage,
    /h1\[tabindex="-1"\]:focus,[\s\S]{0,180}h2\[tabindex="-1"\]:focus\s*\{[\s\S]{0,260}text-decoration-color\s*:\s*var\(--amber\)/i,
  );
});

test("valid initial hash opens exactly one accessible app screen", async () => {
  const harness = await createAppHarness({ hash: "#creating" });
  assertActivePage(harness, "creating");
  assert.equal(harness.root.getAttribute("data-app-direction"), null, "initial App launch must not impersonate a tab change");
  assert.equal(harness.historyPushes.length, 0, "initial deep link must not add history");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
});

test("initial deep links settle at the page top after native fragment scrolling", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  harness.setScroll(720);
  harness.dispatchWindow("load");
  harness.flushFrames();
  assertActivePage(harness, "about");
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
});

test("initial load never overrides a scroll after user interaction", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  harness.setScroll(240);
  harness.dispatchDocument("pointerdown", { type: "pointerdown" });
  const callsBeforeLoad = harness.scrollCalls.length;
  harness.dispatchWindow("load");
  harness.flushFrames();
  assert.equal(harness.window.pageYOffset, 240);
  assert.equal(harness.scrollCalls.length, callsBeforeLoad);
});

test("empty and invalid initial hashes safely fall back to Home", async () => {
  for (const hash of ["", "#not-a-page"]) {
    const harness = await createAppHarness({ hash });
    assertActivePage(harness, "home");
    assert.equal(harness.historyPushes.length, 0);
  }
});

test("mobile links activate one page and push history once", async () => {
  const harness = await createAppHarness();
  harness.flushFrames();

  const event = harness.click("building");
  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.historyPushes.length, 1);
  assert.equal(harness.historyPushes[0].state.appPage, "building");
  assert.equal(harness.historyPushes[0].title, "");
  assert.equal(harness.historyPushes[0].url, "#building");
  assert.equal(harness.location.hash, "#building");
  assertActivePage(harness, "building");
  assert.equal(harness.root.getAttribute("data-app-direction"), "forward");
  harness.flushFrames();
  assert.equal(harness.screens.get("building").heading.focusCount, 1, "new page heading should be announced");
});

test("Settings opens from the current page without becoming a sixth primary tab", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  harness.setScroll(237);

  const event = harness.click("settings", harness.settingsLink);
  assert.equal(event.defaultPrevented, true);
  assert.equal(harness.historyPushes.length, 1);
  assert.equal(harness.historyPushes[0].state.appPage, "settings");
  assert.equal(harness.historyPushes[0].state.fromAppPage, "about");
  assert.equal(harness.historyPushes[0].title, "");
  assert.equal(harness.historyPushes[0].url, "#settings");
  assertActivePage(harness, "settings");
  for (const id of primaryPageIds) {
    assert.equal(harness.tabs.get(id).getAttribute("aria-current"), null, `${id} must not stay current in Settings`);
  }
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
  assert.equal(harness.screens.get("settings").heading.focusCount, 1, "Settings heading should be announced");
});

test("Settings back uses browser history and restores the origin scroll and focus", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  harness.setScroll(237);
  harness.click("settings", harness.settingsLink);
  harness.flushFrames();

  const back = harness.click("settings-back", harness.settingsBack);
  assert.equal(back.defaultPrevented, true);
  assert.equal(harness.historyBacks.length, 1, "Settings back should traverse the entry it pushed");
  assert.equal(harness.historyPushes.length, 1, "Settings back must not push another entry");

  const originState = { appPage: "about" };
  harness.window.history.state = originState;
  harness.location.hash = "#about";
  harness.dispatchWindow("popstate", { type: "popstate", state: originState });
  assertActivePage(harness, "about");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 237]);
  assert.equal(harness.screens.get("about").heading.focusCount, 1, "origin heading should regain focus");
});

test("a direct Settings deep link falls back to Home without leaving the site", async () => {
  const harness = await createAppHarness({ hash: "#settings" });
  assertActivePage(harness, "settings");
  harness.flushFrames();

  const back = harness.click("settings-back", harness.settingsBack);
  assert.equal(back.defaultPrevented, true);
  assert.equal(harness.historyBacks.length, 0, "a direct Settings load has no in-site entry to traverse");
  assert.equal(harness.historyReplaces.at(-1).url, "#home");
  assert.equal(harness.location.hash, "#home");
  assertActivePage(harness, "home");
  harness.flushFrames();
  assert.equal(harness.screens.get("home").heading.focusCount, 1);
});

test("leaving App mode from Settings canonicalizes to its desktop origin", async () => {
  const harness = await createAppHarness({ hash: "#now" });
  harness.flushFrames();
  harness.setScroll(190);
  harness.click("settings", harness.settingsLink);
  harness.flushFrames();
  assertActivePage(harness, "settings");

  harness.setMobile(false);
  assert.equal(harness.root.classList.contains("app-mode"), false);
  assert.equal(harness.location.hash, "#now");
  assert.equal(harness.historyReplaces.at(-1).url, "#now");
  for (const id of primaryPageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
  assertPartState(harness.screens.get("settings"), false, "desktop Settings screen");
  assertPartState(harness.footer, true, "desktop footer");
});

test("a fine-only desktop canonicalizes a Settings hash to Home", async () => {
  const harness = await createAppHarness({ hash: "#settings", mobile: false });
  assert.equal(harness.root.classList.contains("app-mode"), false);
  assert.equal(harness.location.hash, "#home");
  assert.equal(harness.historyReplaces.at(-1).url, "#home");
  for (const id of primaryPageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
  assertPartState(harness.screens.get("settings"), false, "desktop Settings screen");
});

test("desktop Settings canonicalization is unconditional instead of transition-only", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const syncStart = homepage.indexOf("    var syncAppMode = function(){");
  const syncEnd = homepage.indexOf("    var syncAppHistory = function", syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, "App mode synchronizer is missing");
  const syncSource = homepage.slice(syncStart, syncEnd);
  assert.match(syncSource, /window\.location\.hash === '#settings'/);
  const desktopBranch = syncSource.slice(syncSource.indexOf("      } else {"));
  assert.match(
    desktopBranch,
    /if \(window\.location\.hash === '#settings' && window\.history\.replaceState\)/,
    "desktop #settings cleanup must run directly in the desktop branch",
  );
  assert.doesNotMatch(desktopBranch, /if \(entering[^)]*\)/);
});

test("popstate and hashchange restore pages without adding history", async () => {
  const harness = await createAppHarness();
  harness.flushFrames();
  harness.click("about");
  harness.flushFrames();
  harness.setScroll(130);
  harness.click("creating");
  harness.flushFrames();
  assert.equal(harness.historyPushes.length, 2);

  harness.location.hash = "#about";
  harness.dispatchWindow("popstate");
  assertActivePage(harness, "about");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 130]);
  assert.equal(harness.historyPushes.length, 2, "back navigation must not write new history");

  harness.location.hash = "#now";
  harness.dispatchWindow("hashchange");
  assertActivePage(harness, "now");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
  assert.equal(harness.historyPushes.length, 2, "hash navigation must not write new history");
});

test("one history traversal is deduplicated across popstate and hashchange", async () => {
  const harness = await createAppHarness();
  harness.flushFrames();
  harness.click("about");
  harness.flushFrames();
  harness.click("creating");
  harness.flushFrames();

  harness.location.hash = "#about";
  const scrollsBeforeBack = harness.scrollCalls.length;
  const focusBeforeBack = harness.screens.get("about").heading.focusCount;
  harness.dispatchWindow("popstate");
  harness.dispatchWindow("hashchange");
  assert.equal(harness.root.getAttribute("data-app-direction"), "back");
  harness.flushFrames();
  assert.equal(harness.scrollCalls.length, scrollsBeforeBack + 1);
  assert.equal(harness.screens.get("about").heading.focusCount, focusBeforeBack + 1);
});

test("rapid App tab changes keep only the final page motion and focus target", async () => {
  const harness = await createAppHarness();
  harness.flushFrames();
  const scrollsBefore = harness.scrollCalls.length;

  harness.click("about");
  harness.click("building");
  harness.click("creating");

  assertActivePage(harness, "creating");
  assert.equal(harness.root.getAttribute("data-app-direction"), "back");
  assert.equal(harness.historyPushes.length, 3);
  harness.flushFrames();
  assert.equal(harness.scrollCalls.length, scrollsBefore + 1, "superseded App frames must be cancelled");
  assert.equal(harness.screens.get("about").heading.focusCount, 0);
  assert.equal(harness.screens.get("building").heading.focusCount, 0);
  assert.equal(harness.screens.get("creating").heading.focusCount, 1);
});

test("non-page hashes do not switch the active App screen", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  harness.location.hash = "#main";
  harness.dispatchWindow("hashchange");
  assertActivePage(harness, "about");
});

test("Skip-to-content history remembers the App page it belongs to", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  harness.setScroll(400);
  const mainLink = createElement({ tagName: "a", attributes: { href: "#main" } });
  mainLink.parentNode = {};
  const skipped = harness.click("main", mainLink);
  harness.flushFrames();
  assert.equal(skipped.defaultPrevented, true);
  assert.equal(harness.screens.get("about").heading.focusCount, 1, "Skip should move focus into the visible App page");
  const mainEntry = harness.historyPushes.at(-1);
  assert.equal(mainEntry.state.appPage, "about");
  assert.equal(mainEntry.state.anchor, "main");

  harness.click("building");
  harness.flushFrames();
  assertActivePage(harness, "building");
  harness.location.hash = "#main";
  harness.dispatchWindow("popstate", { type: "popstate", state: mainEntry.state });
  harness.dispatchWindow("hashchange", { type: "hashchange" });
  assertActivePage(harness, "about");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0], "the #main entry should stay at the App page start");

  harness.location.hash = "#about";
  harness.dispatchWindow("popstate", { type: "popstate", state: null });
  harness.dispatchWindow("hashchange", { type: "hashchange" });
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 400], "Back should restore the position before Skip");

  const focusBeforeForward = harness.screens.get("about").heading.focusCount;
  harness.location.hash = "#main";
  harness.dispatchWindow("popstate", { type: "popstate", state: mainEntry.state });
  harness.dispatchWindow("hashchange", { type: "hashchange" });
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
  assert.equal(harness.screens.get("about").heading.focusCount, focusBeforeForward + 1);
});

test("each screen keeps its own scroll and a repeated tab returns to top", async () => {
  const harness = await createAppHarness();
  harness.flushFrames();
  harness.setScroll(480);

  harness.click("about");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
  harness.setScroll(130);

  harness.click("home");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 480]);
  const pushesBeforeRepeat = harness.historyPushes.length;

  const repeated = harness.click("home");
  harness.flushFrames();
  assert.equal(repeated.defaultPrevented, true);
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 0]);
  assert.equal(harness.historyPushes.length, pushesBeforeRepeat, "reselecting a tab must not duplicate history");

  harness.click("about");
  harness.flushFrames();
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 130]);
});

test("leaving the iPad App breakpoint restores the full desktop document", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  assertActivePage(harness, "about");

  harness.setMobile(false);
  assert.equal(harness.root.classList.contains("app-mode"), false);
  assert.equal(harness.root.getAttribute("data-app-page"), null);
  for (const id of primaryPageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
  assertPartState(harness.screens.get("settings"), false, "desktop Settings screen");
  assertPartState(harness.footer, true, "desktop footer");

  const pushesBeforeDesktopClick = harness.historyPushes.length;
  const desktopClick = harness.click("creating");
  assert.equal(desktopClick.defaultPrevented, false, "desktop anchors must retain native navigation");
  assert.equal(harness.historyPushes.length, pushesBeforeDesktopClick);

  harness.setMobile(true);
  assertActivePage(harness, "about");
});

test("a fine-only desktop starts without App motion or mounted-screen side effects", async () => {
  const harness = await createAppHarness({ mobile: false });
  assert.equal(harness.root.classList.contains("app-mode"), false);
  assert.equal(harness.root.getAttribute("data-app-page"), null);
  assert.equal(harness.root.getAttribute("data-app-direction"), null);
  for (const id of primaryPageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
  assertPartState(harness.screens.get("settings"), false, "desktop Settings screen");
  assertPartState(harness.footer, true, "desktop footer");
  const event = harness.click("about");
  assert.equal(event.defaultPrevented, false);
  assert.equal(harness.historyPushes.length, 0);
  assert.equal(harness.scrollCalls.length, 0);
});

test("reduced motion disables every App launch and page-plane animation", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const start = homepage.lastIndexOf("@media (prefers-reduced-motion:reduce){");
  const end = homepage.indexOf("</style>", start);
  assert.ok(start >= 0 && end > start, "final reduced-motion block is missing");
  const reducedBlock = homepage.slice(start, end);
  for (const selector of [
    "html.app-mode .topbar",
    "html.app-mode .mobile-tabbar",
    "html.app-mode .brand-mark",
    "html.app-mode .app-menu-trigger",
    "html.app-mode .app-menu-drawer",
    "html.app-mode .app-menu-nav a",
    "html.app-mode .mobile-tabbar a[aria-current]::after",
    "html.app-mode [data-app-screen]:not([hidden])",
  ]) {
    assert.ok(reducedBlock.includes(selector), `${selector} must be static for reduced-motion users`);
  }
  assert.match(reducedBlock, /\{animation:none!important\}/);
});

test("leaving App mode cancels a pending mobile scroll frame", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.setMobile(false);
  harness.flushFrames();
  assert.equal(harness.scrollCalls.length, 0);
  assert.equal(harness.root.classList.contains("app-mode"), false);
  for (const id of primaryPageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
  assertPartState(harness.screens.get("settings"), false, "desktop Settings screen");
});

test("orientation changes preserve the reading offset inside the active page", async () => {
  const harness = await createAppHarness({ hash: "#building" });
  harness.flushFrames();
  const building = harness.screens.get("building");
  building.getBoundingClientRect = () => harness.root.classList.contains("app-mode")
    ? { top: -330, bottom: 1670, height: 2000 }
    : { top: 2000, bottom: 5000, height: 3000 };
  harness.topbar.getBoundingClientRect = () => harness.root.classList.contains("app-mode")
    ? { top: 8, bottom: 70, height: 62 }
    : { top: 0, bottom: 80, height: 80 };
  harness.setScroll(400);

  harness.setMobile(false);
  assert.deepEqual(harness.scrollCalls.at(-1), [0, 2720]);
});

test("re-entering App mode follows the desktop section instead of a stale hash", async () => {
  const harness = await createAppHarness({ hash: "#creating" });
  harness.flushFrames();
  harness.setMobile(false);
  harness.flushFrames();
  harness.location.hash = "#home";
  harness.setMobile(true);
  assertActivePage(harness, "creating");
  assert.equal(harness.location.hash, "#creating");
  assert.equal(harness.historyReplaces.at(-1).url, "#creating");
});

test("the footer is mounted only on the Work app screen", async () => {
  for (const id of appPageIds) {
    const harness = await createAppHarness({ hash: `#${id}` });
    assertPartState(harness.footer, id === "building", `${id} footer`);
  }
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);
const pageIds = ["home", "about", "creating", "now", "building"];

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
    querySelector(selector) {
      return selector === "h1,h2" ? heading : null;
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

async function createAppHarness({ hash = "", mobile = true } = {}) {
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
  const scrollCalls = [];
  let nextFrameId = 1;

  const root = createElement({ tagName: "html" });
  root.classList = createClassList();
  root.scrollTop = 0;

  const screens = new Map(pageIds.map((id) => [
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
  const tabs = new Map(pageIds.map((id) => [
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
  const siteLinks = new Map(pageIds.slice(1).map((id) => [
    id,
    createElement({ tagName: "a", attributes: { href: `#${id}` } }),
  ]));
  const sectionLinks = [...siteLinks.values(), ...tabs.values()];

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
    querySelectorAll(selector) {
      if (selector === '.site-nav a[href^="#"], .mobile-tabbar a[href^="#"]') return sectionLinks;
      if (selector === "[data-app-screen]") return [...screens.values()];
      if (selector === "[data-app-screen-extra]") return [footer];
      return [];
    },
    querySelector(selector) {
      const match = selector.match(/^\[data-app-screen="([^"]+)"\]$/);
      return match ? screens.get(match[1]) || null : null;
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
  };
  for (const element of [...screens.values(), footer, ...sectionLinks]) element.parentNode = document;

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
      pushState(state, title, url) {
        historyPushes.push({ state, title, url });
        const index = url.indexOf("#");
        location.hash = index >= 0 ? url.slice(index) : "";
      },
      replaceState(state, title, url) {
        historyReplaces.push({ state, title, url });
        const index = url.indexOf("#");
        location.hash = index >= 0 ? url.slice(index) : "";
      },
    },
    matchMedia(query) {
      assert.equal(query, "(max-width: 820px)");
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
    requestAnimationFrame,
    cancelAnimationFrame,
  };

  vm.runInContext(source, vm.createContext({
    cancelAnimationFrame,
    clearTimeout: () => undefined,
    document,
    requestAnimationFrame,
    root,
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
    historyPushes,
    historyReplaces,
    location,
    root,
    screens,
    scrollCalls,
    setMobile,
    setScroll,
    siteLinks,
    tabs,
    window,
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
  for (const id of pageIds) {
    assertPartState(harness.screens.get(id), id === activeId, `${id} screen`);
    assert.equal(
      harness.tabs.get(id).getAttribute("aria-current"),
      id === activeId ? "page" : null,
      `${id} tab current-page state is wrong`,
    );
  }
  assertPartState(harness.footer, activeId === "building", "Work footer");
}

test("mobile app markup exposes five ordered screens and tabs", async () => {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const screenTags = Array.from(
    homepage.matchAll(/<(?:header|section)\b[^>]*\bdata-app-screen=(['"])(.*?)\1[^>]*>/gi),
    (match) => ({ id: match[2], tag: match[0] }),
  );
  assert.deepEqual(screenTags.map(({ id }) => id), pageIds);
  for (const { id, tag } of screenTags) {
    assert.equal(attribute(tag, "id"), id, `${id} screen id must match its app route`);
    assert.doesNotMatch(tag, /\s(?:hidden|inert)(?=\s|=|>)/i, `${id} must remain visible in the desktop/no-JS source`);
    assert.equal(attribute(tag, "aria-hidden"), null, `${id} must not be hidden in the source`);
  }

  const tabbar = homepage.match(/<nav class="mobile-tabbar"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(tabbar, "mobile tabbar is missing");
  const tabTags = Array.from(tabbar.matchAll(/<a\b[^>]*\bdata-app-tab\b[^>]*>/gi), (match) => match[0]);
  assert.deepEqual(tabTags.map((tag) => attribute(tag, "href")), pageIds.map((id) => `#${id}`));
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
  harness.flushFrames();
  assert.equal(harness.screens.get("building").heading.focusCount, 1, "new page heading should be announced");
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

test("leaving the 820px app breakpoint restores the full desktop document", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.flushFrames();
  assertActivePage(harness, "about");

  harness.setMobile(false);
  assert.equal(harness.root.classList.contains("app-mode"), false);
  assert.equal(harness.root.getAttribute("data-app-page"), null);
  for (const id of pageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
  assertPartState(harness.footer, true, "desktop footer");

  const pushesBeforeDesktopClick = harness.historyPushes.length;
  const desktopClick = harness.click("creating");
  assert.equal(desktopClick.defaultPrevented, false, "desktop anchors must retain native navigation");
  assert.equal(harness.historyPushes.length, pushesBeforeDesktopClick);

  harness.setMobile(true);
  assertActivePage(harness, "about");
});

test("leaving App mode cancels a pending mobile scroll frame", async () => {
  const harness = await createAppHarness({ hash: "#about" });
  harness.setMobile(false);
  harness.flushFrames();
  assert.equal(harness.scrollCalls.length, 0);
  assert.equal(harness.root.classList.contains("app-mode"), false);
  for (const id of pageIds) assertPartState(harness.screens.get(id), true, `${id} desktop screen`);
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
  for (const id of pageIds) {
    const harness = await createAppHarness({ hash: `#${id}` });
    assertPartState(harness.footer, id === "building", `${id} footer`);
  }
});

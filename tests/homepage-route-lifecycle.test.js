import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
  };
}

async function createRouteHarness({ mobile = false } = {}) {
  const homepage = await readFile(new URL("index.html", rootUrl), "utf8");
  const start = homepage.indexOf("  var ROUTE_DURATION = 420;");
  const end = homepage.indexOf("  /* Everything below is visual motion enhancement.", start);
  assert.ok(start >= 0 && end > start, "route controller block is missing");
  const routeSource = homepage.slice(start, end);

  const documentListeners = new Map();
  const windowListeners = new Map();
  const timers = new Map();
  const assigned = [];
  let nextTimerId = 1;

  const pageRoot = { classList: createClassList() };
  const transitionAttributes = new Map([["aria-hidden", "true"]]);
  const routeTransition = {
    style: { setProperty: () => undefined },
    setAttribute: (name, value) => transitionAttributes.set(name, value),
  };
  const routeDestination = { textContent: "" };
  const anchor = {
    href: "https://www.youtube.com/@HarryXin",
    dataset: { destination: "YOUTUBE" },
    classList: createClassList(),
    getAttribute: (name) => (name === "href" ? anchor.href : null),
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ left: 24, top: 80, width: 120, height: 48 }),
  };

  const document = {
    hidden: false,
    getElementById: (id) => {
      if (id === "route-transition") return routeTransition;
      if (id === "route-destination") return routeDestination;
      return null;
    },
    addEventListener: (type, listener) => documentListeners.set(type, listener),
    querySelectorAll: () => [],
  };
  const matchMedia = (query) => ({
    matches: mobile && /max-width:\s*600px|pointer:\s*coarse/.test(query),
  });
  const window = {
    innerWidth: 390,
    innerHeight: 844,
    location: {
      href: "https://harryxin.com/",
      assign: (href) => assigned.push(href),
    },
    setTimeout: (callback, delay) => {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    matchMedia,
  };

  vm.runInContext(routeSource, vm.createContext({
    URL,
    document,
    matchMedia,
    reduce: false,
    root: pageRoot,
    window,
  }));

  const click = () => {
    const event = {
      target: { closest: () => anchor },
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    documentListeners.get("click")(event);
    return event;
  };
  const runTimerAtDelay = (delay) => {
    const timer = Array.from(timers.entries()).find(([, entry]) => entry.delay === delay);
    assert.ok(timer, `expected a ${delay}ms timer`);
    timers.delete(timer[0]);
    timer[1].callback();
  };
  const assertReset = () => {
    assert.equal(pageRoot.classList.contains("is-leaving"), false);
    assert.equal(anchor.classList.contains("is-routing"), false);
    assert.equal(transitionAttributes.get("aria-hidden"), "true");
  };

  return {
    anchor,
    assigned,
    assertReset,
    click,
    document,
    documentListeners,
    pageRoot,
    runTimerAtDelay,
    timers,
    transitionAttributes,
    windowListeners,
  };
}

test("route curtain recovers when a mobile app handoff returns", async () => {
  for (const lifecycle of ["visibilitychange", "focus"]) {
    const harness = await createRouteHarness();
    const event = harness.click();
    assert.equal(event.defaultPrevented, true);
    assert.equal(harness.pageRoot.classList.contains("is-leaving"), true);
    assert.equal(harness.anchor.classList.contains("is-routing"), true);
    assert.equal(harness.transitionAttributes.get("aria-hidden"), "false");

    harness.runTimerAtDelay(420);
    assert.deepEqual(harness.assigned, ["https://www.youtube.com/@HarryXin"]);

    if (lifecycle === "visibilitychange") {
      harness.document.hidden = false;
      harness.documentListeners.get("visibilitychange")();
    } else {
      harness.windowListeners.get("focus")();
    }
    harness.assertReset();
  }
});

test("mobile and coarse pointers navigate immediately without a route curtain", async () => {
  const harness = await createRouteHarness({ mobile: true });
  const event = harness.click();

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(harness.assigned, ["https://www.youtube.com/@HarryXin"]);
  assert.equal(harness.pageRoot.classList.contains("is-leaving"), false);
  assert.equal(harness.anchor.classList.contains("is-routing"), false);
  assert.equal(harness.transitionAttributes.get("aria-hidden"), "true");
  assert.equal(harness.timers.size, 0);
});

test("focus before the desktop commit does not cancel navigation", async () => {
  const harness = await createRouteHarness();
  harness.click();
  harness.windowListeners.get("focus")();

  assert.equal(harness.pageRoot.classList.contains("is-leaving"), true);
  harness.runTimerAtDelay(420);
  assert.deepEqual(harness.assigned, ["https://www.youtube.com/@HarryXin"]);
  harness.windowListeners.get("focus")();
  harness.assertReset();
});

test("route curtain watchdog fails open when navigation does not unload", async () => {
  const harness = await createRouteHarness();
  harness.click();
  harness.runTimerAtDelay(420);

  const recoveryTimer = Array.from(harness.timers.values()).find(({ delay }) => delay > 420);
  assert.ok(recoveryTimer, "route curtain needs a recovery watchdog");
  assert.ok(recoveryTimer.delay <= 2500, "route recovery must not feel stuck");
  harness.runTimerAtDelay(recoveryTimer.delay);
  harness.assertReset();
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const detailPages = [
  "projects/finditem/index.html",
  "projects/viralens/index.html",
  "rlcard/index.html",
  "rlcard/research/index.html",
];

test("every case-study route exposes a Work back control", async () => {
  for (const path of detailPages) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, /href="\/#building"[^>]*data-work-back|data-work-back[^>]*href="\/#building"/i, `${path} is missing its Work back control`);
    assert.match(source, /\/assets\/work-back\.js/, `${path} is missing the shared history-aware back controller`);
  }
});

test("existing detail routes use the non-blocking six-pixel entry contract", async () => {
  const css = await readFile(new URL("assets/detail-entry.css", root), "utf8");
  assert.match(css, /translate3d\(0,\s*6px,\s*0\)/, "detail entry must stay within six pixels");
  assert.match(css, /280ms/, "detail entry should not gate navigation");
  assert.match(css, /prefers-reduced-motion[\s\S]*100ms/, "reduced motion must use a short opacity-only response");

  for (const path of detailPages.filter((path) => path !== "projects/viralens/index.html")) {
    const source = await readFile(new URL(path, root), "utf8");
    assert.match(source, /\/assets\/detail-entry\.css/, `${path} is missing the shared detail entry`);
  }
});

test("Work back restores the portfolio in one step even after detail-page anchors", async () => {
  const source = await readFile(new URL("assets/work-back.js", root), "utf8");
  const createHarness = (referrer) => {
    let clickHandler;
    let hashHandler;
    const backCalls = [];
    const goCalls = [];
    const document = {
      referrer,
      addEventListener(type, handler) {
        if (type === "click") clickHandler = handler;
      },
    };
    const history = {
      length: 4,
      state: null,
      back() { backCalls.push(true); },
      go(delta) { goCalls.push(delta); },
      replaceState(state) { this.state = state; },
    };
    const window = {
      location: {
        origin: "https://harryxin.com",
        href: "https://harryxin.com/projects/viralens",
      },
      history,
      addEventListener(type, handler) {
        if (type === "hashchange") hashHandler = handler;
      },
    };
    vm.runInNewContext(source, { document, window, URL });
    return { backCalls, clickHandler, goCalls, hashHandler, history };
  };
  const eventFor = (kind) => {
    let prevented = false;
    const event = {
      target: {
        closest(selector) {
          if (kind === "hash" && selector === 'a[href^="#"]') return {};
          if (kind === "back" && selector === "[data-work-back]") return {};
          return null;
        },
      },
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() { prevented = true; },
    };
    return { event, prevented: () => prevented };
  };

  const sameOrigin = createHarness("https://harryxin.com/#building");
  assert.equal(typeof sameOrigin.clickHandler, "function");
  assert.equal(sameOrigin.history.state.hxWorkDepth, 0);

  sameOrigin.clickHandler(eventFor("hash").event);
  sameOrigin.history.state = null;
  sameOrigin.hashHandler();
  assert.equal(sameOrigin.history.state.hxWorkDepth, 1);

  const backEvent = eventFor("back");
  sameOrigin.clickHandler(backEvent.event);
  assert.equal(backEvent.prevented(), true);
  assert.deepEqual(sameOrigin.goCalls, [-2], "one activation must clear the detail anchor and return to Work");
  assert.equal(sameOrigin.backCalls.length, 0);

  const external = createHarness("https://example.com/");
  const fallbackEvent = eventFor("back");
  external.clickHandler(fallbackEvent.event);
  assert.equal(fallbackEvent.prevented(), false, "direct or external visits must keep the /#building fallback link");
  assert.equal(external.goCalls.length, 0);
  assert.equal(external.backCalls.length, 0);
});

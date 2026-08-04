import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const pageUrl = new URL("projects/finditem/index.html", root);
const featuresUrl = new URL("projects/finditem/features.js", root);

function openingTags(source, tagName) {
  return Array.from(
    source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi")),
    (match) => match[0],
  );
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function relIncludes(tag, value) {
  return (attribute(tag, "rel") || "").split(/\s+/).includes(value);
}

function renderedText(source) {
  return source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function storageKeys(source, method) {
  const constants = new Map(
    Array.from(
      source.matchAll(
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])(.*?)\2/g,
      ),
      (match) => [match[1], match[3]],
    ),
  );
  const calls = source.matchAll(
    new RegExp(
      `(?:window\\.)?localStorage\\.${method}\\(\\s*((?:["'][^"']*["'])|(?:[A-Za-z_$][\\w$]*))`,
      "g",
    ),
  );

  return new Set(Array.from(calls, (match) => {
    const argument = match[1];
    if (/^["']/.test(argument)) return argument.slice(1, -1);
    return constants.get(argument);
  }).filter(Boolean));
}

test("FindItem project route ships both static assets", async () => {
  const [page, features] = await Promise.all([stat(pageUrl), stat(featuresUrl)]);

  assert.ok(page.isFile(), "projects/finditem/index.html must be a file");
  assert.ok(features.isFile(), "projects/finditem/features.js must be a file");
});

test("homepage FindItem card links to the internal case study", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const findItemCard = openingTags(homepage, "a").find(
    (tag) => attribute(tag, "data-destination") === "FINDITEM",
  );

  assert.ok(findItemCard, "homepage FindItem project card is missing");
  assert.equal(
    attribute(findItemCard, "href"),
    "/projects/finditem",
    "FindItem card must use the canonical internal route",
  );
});

test("FindItem metadata and navigation belong to harryxin.com", async () => {
  const page = await readFile(pageUrl, "utf8");
  const links = openingTags(page, "link");
  const metas = openingTags(page, "meta");
  const anchors = openingTags(page, "a");
  const scripts = openingTags(page, "script");
  const canonicalUrl = "https://harryxin.com/projects/finditem";

  const canonical = links.find((tag) => relIncludes(tag, "canonical"));
  assert.ok(canonical, "FindItem canonical link is missing");
  assert.equal(attribute(canonical, "href"), canonicalUrl);

  const openGraphUrl = metas.find((tag) => attribute(tag, "property") === "og:url");
  assert.ok(openGraphUrl, "FindItem og:url metadata is missing");
  assert.equal(attribute(openGraphUrl, "content"), canonicalUrl);

  const favicon = links.find((tag) => relIncludes(tag, "icon"));
  assert.ok(favicon, "FindItem favicon link is missing");
  assert.equal(attribute(favicon, "href"), "/assets/favicon.svg");

  const projectBackLinks = anchors.filter((tag) => attribute(tag, "href") === "/#building");
  assert.ok(
    projectBackLinks.length >= 3,
    "desktop navigation, mobile navigation, and footer must each link back to /#building",
  );

  const featureScript = scripts.find(
    (tag) => attribute(tag, "src") === "/projects/finditem/features.js",
  );
  assert.ok(featureScript, "features.js must use an absolute sub-route URL");
  assert.ok(
    !scripts.some((tag) => attribute(tag, "src") === "features.js"),
    "features.js must not use a document-relative URL",
  );
});

test("architecture evolution copy is bilingual and honest about deployment status", async () => {
  const [page, features] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(featuresUrl, "utf8"),
  ]);
  const copy = renderedText(`${page}\n${features}`);

  assert.match(page, /从单箱原型到\s*30\s*箱部署/);
  assert.match(
    page,
    /from (?:a |the )?(?:single|one)[ -]bin prototype to (?:a |the )?30[ -]bin deployment/i,
  );
  assert.match(page, /\bPLANNED\b/);
  assert.match(page, /评估中/);

  assert.match(page, /ESP32-C3/);
  assert.match(page, /\bMQTT\b/);
  assert.match(page, /\bLED\b/);
  assert.match(page, /蜂鸣器|\bbuzzer\b/i);

  for (const amount of ["360", "76", "108", "132"]) {
    assert.match(
      page,
      new RegExp(`(?:¥|&yen;|&#165;)\\s*${amount}\\b`),
      `architecture comparison is missing the ¥${amount} estimate`,
    );
  }

  assert.match(page, /30\s*(?:个\s*)?箱/);
  assert.match(page, /30[ -]bins?/i);
  assert.match(page, /3\s*排\s*[×xX]\s*10/);
  assert.match(page, /3\s*rows?\s*[×xX]\s*10/i);

  assert.doesNotMatch(
    copy,
    /\b(?:20|25|40)\s*(?:个\s*)?(?:demo\s*)?(?:箱|套|bins?\b)/i,
    "legacy 20/25/40-bin deployment targets must not remain",
  );
});

test("FindItem remains a self-contained static simulation", async () => {
  const [page, features] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(featuresUrl, "utf8"),
  ]);
  const combined = `${page}\n${features}`;

  assert.doesNotMatch(combined, /fonts\.(?:googleapis|gstatic)\.com/i);

  const externalStylesheets = openingTags(page, "link").filter((tag) => {
    const href = attribute(tag, "href") || "";
    return relIncludes(tag, "stylesheet") && /^(?:https?:)?\/\//i.test(href);
  });
  assert.deepEqual(externalStylesheets, [], "external stylesheets are not permitted");

  assert.doesNotMatch(combined, /\bfetch\s*\(/);
  assert.doesNotMatch(combined, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(combined, /\b(?:WebSocket|EventSource)\s*\(/);
  assert.doesNotMatch(combined, /\bmqtt\s*\.\s*connect\s*\(/i);
  assert.doesNotMatch(combined, /\b(?:mqtts?|wss?):\/\//i);
  assert.match(combined, /静态模拟|static simulation/i);
  assert.doesNotMatch(
    combined,
    /每个零件箱上(?:都)?贴有二维码|every parts bin has a QR code/i,
    "planned QR entry must not read as an installed school deployment",
  );
  assert.match(page, /aria-disabled/);
});

test("FindItem shares language preference and isolates its theme preference", async () => {
  const page = await readFile(pageUrl, "utf8");
  const readKeys = storageKeys(page, "getItem");
  const writeKeys = storageKeys(page, "setItem");

  assert.ok(readKeys.has("lang"), "expected localStorage to read lang");
  assert.ok(writeKeys.has("lang"), "expected localStorage to write lang");
  assert.ok(readKeys.has("finditem-theme"), "expected localStorage to read finditem-theme");
  assert.ok(writeKeys.has("finditem-theme"), "expected localStorage to write finditem-theme");
  assert.ok(
    !readKeys.has("theme") && !writeKeys.has("theme"),
    "the legacy generic theme key would conflict with other harryxin.com pages",
  );
});

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const pageUrl = new URL("projects/viralens/index.html", root);
const stylesUrl = new URL("projects/viralens/styles.css", root);
const appUrl = new URL("projects/viralens/app.js", root);
const assetNames = [
  "viralens-overview-dark.png",
  "viralens-overview-light.png",
  "form-spread.png",
  "second-person-falsified.png",
  "meme-falsified.png",
];

function openingTags(source, tagName) {
  return Array.from(source.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi")), (match) => ({
    index: match.index,
    tag: match[0],
  }));
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function relIncludes(tag, value) {
  return (attribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes(value);
}

function renderedText(source) {
  return source.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ");
}

test("ViraLens case study ships a self-contained static route and local visual assets", async () => {
  const entries = await Promise.all([
    stat(pageUrl),
    stat(stylesUrl),
    stat(appUrl),
    ...assetNames.map((name) => stat(new URL(`projects/viralens/assets/${name}`, root))),
  ]);

  for (const entry of entries) assert.ok(entry.isFile());
  for (const entry of entries.slice(3)) assert.ok(entry.size > 0, "ViraLens visual asset must not be empty");
});

test("ViraLens metadata, HX chrome, and navigation belong to harryxin.com", async () => {
  const page = await readFile(pageUrl, "utf8");
  const links = openingTags(page, "link");
  const metas = openingTags(page, "meta");
  const anchors = openingTags(page, "a");
  const scripts = openingTags(page, "script");

  const canonical = links.find(({ tag }) => relIncludes(tag, "canonical"));
  assert.ok(canonical);
  assert.equal(attribute(canonical.tag, "href"), "https://harryxin.com/projects/viralens");

  const ogUrl = metas.find(({ tag }) => attribute(tag, "property") === "og:url");
  assert.ok(ogUrl);
  assert.equal(attribute(ogUrl.tag, "content"), "https://harryxin.com/projects/viralens");

  assert.ok(links.some(({ tag }) => attribute(tag, "href") === "/favicon.ico?v=7"));
  assert.ok(links.some(({ tag }) => attribute(tag, "href") === "/assets/hx-logo-icon-v6-xbridge.svg?v=7"));
  assert.match(page, /hx-logo-mark-v6-xbridge\.svg/);
  assert.ok(anchors.some(({ tag }) => attribute(tag, "href") === "/#building"));

  const themeScript = scripts.find(({ tag }) => attribute(tag, "src") === "/assets/site-theme.js");
  const appScript = scripts.find(({ tag }) => attribute(tag, "src") === "/projects/viralens/app.js");
  assert.ok(themeScript && /\bdefer\b/i.test(themeScript.tag));
  assert.ok(appScript && /\bdefer\b/i.test(appScript.tag));
});

test("ViraLens restores shared theme and language before its stylesheet", async () => {
  const [page, app] = await Promise.all([readFile(pageUrl, "utf8"), readFile(appUrl, "utf8")]);
  const stylesheetIndex = page.indexOf('/projects/viralens/styles.css');
  const themeIndex = page.indexOf("harryxin-theme");
  const languageIndex = page.indexOf("localStorage.getItem('lang')");

  assert.ok(themeIndex >= 0 && themeIndex < stylesheetIndex);
  assert.ok(languageIndex >= 0 && languageIndex < stylesheetIndex);
  assert.match(page.slice(themeIndex, stylesheetIndex), /data-theme-mode/);
  assert.match(page.slice(themeIndex, stylesheetIndex), /prefers-color-scheme:\s*light/);
  assert.match(page.slice(themeIndex, stylesheetIndex), /['"]system['"]/);
  assert.match(page, /\bdata-theme-toggle\b/);
  assert.match(page, /\bdata-lang-toggle\b/);
  assert.match(app, /localStorage\.getItem\(storageKey\)/);
  assert.match(app, /localStorage\.setItem\(storageKey, language\)/);
  assert.match(app, /addEventListener\(['"]storage['"]/);
  assert.match(app, /addEventListener\(['"]pageshow['"]/);
});

test("ViraLens presents the required bilingual research story and observed samples", async () => {
  const page = await readFile(pageUrl, "utf8");
  const copy = renderedText(page);

  assert.match(page, /data-lang="en"/);
  assert.match(page, /data-lang="zh"/);
  assert.match(copy, /14 Bilibili creators/);
  assert.match(page, /<strong>14<\/strong>[\s\S]{0,140}位 B 站创作者/);
  assert.match(copy, /5 content zones/);
  assert.match(page, /<strong>5<\/strong>[\s\S]{0,140}个内容分区/);
  assert.match(copy, /549 Bilibili videos/);
  assert.match(page, /<strong>549<\/strong>[\s\S]{0,140}条 B 站视频/);
  assert.match(copy, /4 English YouTube creators/);
  assert.match(page, /<strong>4<\/strong>[\s\S]{0,160}位英文 YouTube 创作者/);
  assert.match(copy, /160 long-form YouTube videos/);
  assert.match(page, /<strong>160<\/strong>[\s\S]{0,160}条 YouTube 长视频/);

  assert.match(copy, /Research framing · data pipeline · analysis · report design/);
  assert.match(copy, /研究问题 · 数据管线 · 分析方法 · 报告设计/);
  assert.match(copy, /title-with-“you” hypothesis did not survive/i);
  assert.match(copy, /标题含“你”的假设，没有通过/);
  assert.match(copy, /0\.91×/);
  assert.match(copy, /FALSIFIED AS UNIVERSAL/);
  assert.match(copy, /不具普遍性/);
});

test("ViraLens states observational limits without presenting causal claims", async () => {
  const page = await readFile(pageUrl, "utf8");
  const copy = renderedText(page);

  assert.match(copy, /observational comparisons · no randomized intervention/i);
  assert.match(copy, /this is an observed within-creator association/i);
  assert.match(copy, /does not establish that format produced the performance difference/i);
  assert.match(copy, /不能证明视频形式产生了播放表现差异/);
  assert.match(copy, /No causality/);
  assert.match(copy, /没有因果结论/);
  assert.doesNotMatch(copy, /format (?:causes?|determines?|drives?) performance/i);
  assert.doesNotMatch(copy, /形式决定成败|形式导致播放|形式造成播放/);
});

test("ViraLens uses all public research visuals locally without embedding the full report", async () => {
  const page = await readFile(pageUrl, "utf8");
  const images = openingTags(page, "img");

  for (const assetName of assetNames) {
    assert.ok(
      images.some(({ tag }) => ["src", "data-logo-night", "data-logo-day"].some(
        (name) => attribute(tag, name) === `/projects/viralens/assets/${assetName}`,
      )),
      `${assetName} must be used by the case study`,
    );
  }
  assert.ok(images.every(({ tag }) => !/^https?:\/\//i.test(attribute(tag, "src") || "")));
  assert.doesNotMatch(page, /<iframe\b/i);
  assert.doesNotMatch(page, /reports\/index\.html/i);

  const sourceLink = openingTags(page, "a").find(
    ({ tag }) => attribute(tag, "href") === "https://github.com/HarryXin0919/viralens",
  );
  assert.ok(sourceLink);
  assert.ok(relIncludes(sourceLink.tag, "noopener"));
});

test("ViraLens entrance is a six-pixel non-blocking reveal with a reduced-motion escape", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const keyframes = styles.match(/@keyframes\s+case-enter\s*\{([\s\S]*?)\n\}/i)?.[1] || "";
  const reduced = styles.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/i)?.[1] || "";

  assert.match(styles, /body\s*\{[\s\S]*?animation:\s*case-enter/i);
  assert.match(keyframes, /translateY\(6px\)/);
  assert.match(keyframes, /translateY\(0\)/);
  assert.doesNotMatch(styles, /pointer-events:\s*none[^}]*case-enter/i);
  assert.match(reduced, /body\s*\{\s*animation:\s*none\s*!important/);
  assert.match(
    styles,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.hero\s*\{[^}]*overflow:\s*hidden/i,
    "mobile hero decoration must be clipped instead of widening the page",
  );
  assert.match(styles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.back-link\s*\{[^}]*min-width:\s*44px/i);
  assert.match(styles, /\.chart-figure--data \.chart-frame\s*\{[^}]*overflow-x:\s*auto/i);
  assert.match(styles, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.reversal-stats\s*\{[^}]*grid-template-columns:\s*1fr/i);

  const page = await readFile(pageUrl, "utf8");
  const overviewImages = openingTags(page, "img").filter(({ tag }) => /viralens-overview/i.test(tag));
  assert.equal(overviewImages.length, 1, "theme variants must share one semantic overview image");
});

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const homepageUrl = new URL("index.html", root);
const sharedThemeUrl = new URL("assets/site-theme.js", root);
const nightLogoUrl = new URL("assets/hx-logo-icon-v6-xbridge.svg", root);
const dayLogoUrl = new URL("assets/hx-logo-icon-v6-xbridge-day.svg", root);
const ironPulseNightUrl = new URL("assets/ironpulse-logo.svg", root);
const ironPulseDayUrl = new URL("assets/ironpulse-logo-day.svg", root);

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

test("homepage ships a real accessible day and night control", async () => {
  const homepage = await readFile(homepageUrl, "utf8");
  const toggle = homepage.match(/<button\b[^>]*data-theme-toggle[^>]*>/i)?.[0];

  assert.ok(toggle, "theme toggle button is missing");
  assert.equal(attribute(toggle, "type"), "button");
  assert.ok(attribute(toggle, "aria-label"), "theme toggle needs an accessible label");
  assert.equal(attribute(toggle, "aria-pressed"), "false");
  assert.match(homepage, /min-height:44px/, "mobile theme control must retain a 44px target");
});

test("theme is restored before CSS and uses the shared site preference", async () => {
  const [homepage, sharedTheme] = await Promise.all([
    readFile(homepageUrl, "utf8"),
    readFile(sharedThemeUrl, "utf8"),
  ]);
  const styleIndex = homepage.indexOf("<style>");
  const prepaintIndex = homepage.indexOf("harryxin-theme");

  assert.ok(prepaintIndex > -1 && prepaintIndex < styleIndex, "saved theme must be restored before CSS is parsed");
  assert.match(homepage, /localStorage\.getItem\(key\)/);
  assert.match(homepage, /src=["']\/assets\/site-theme\.js["'][^>]*\bdefer\b/);
  assert.match(sharedTheme, /localStorage\.setItem\([^,]+,\s*theme\)/);
  assert.doesNotMatch(`${homepage}\n${sharedTheme}`, /localStorage\.(?:getItem|setItem)\(\s*['"]theme['"]/, "generic theme storage would collide with other pages");
  assert.doesNotMatch(`${homepage}\n${sharedTheme}`, /finditem-theme/, "all routes must share harryxin-theme");
  assert.match(homepage, /saved !== 'light' && saved !== 'dark'/, "stored values must be validated");
  assert.match(homepage, /prefers-color-scheme:light/, "first visit should follow the system color scheme");
});

test("manual theme keeps page chrome and brand assets in sync", async () => {
  const [homepage, sharedTheme] = await Promise.all([
    readFile(homepageUrl, "utf8"),
    readFile(sharedThemeUrl, "utf8"),
  ]);

  assert.match(homepage, /id="theme-color"[^>]*data-theme-dark=["'][^"']+["'][^>]*data-theme-light=["'][^"']+["']/);
  assert.match(homepage, /id="site-favicon"[^>]*data-theme-dark=["'][^"']+["'][^>]*data-theme-light=["'][^"']+["']/);
  assert.match(homepage, /data-logo-night="\.\/assets\/hx-logo-mark-v6-xbridge\.svg"/);
  assert.match(homepage, /data-logo-day="\.\/assets\/hx-logo-mark-v6-xbridge-day\.svg"/);
  assert.match(sharedTheme, /data-logo-night/);
  assert.match(sharedTheme, /data-logo-day/);
  assert.match(sharedTheme, /data-theme-dark/);
  assert.match(sharedTheme, /data-theme-light/);
  assert.match(sharedTheme, /setAttribute\(["']href["']/);
  assert.match(sharedTheme, /setAttribute\(["']content["']/);
});

test("daylight palette and both optical logo masters are present", async () => {
  const [homepage, nightLogo, dayLogo, nightStat, dayStat] = await Promise.all([
    readFile(homepageUrl, "utf8"),
    readFile(nightLogoUrl, "utf8"),
    readFile(dayLogoUrl, "utf8"),
    stat(nightLogoUrl),
    stat(dayLogoUrl),
  ]);

  assert.ok(nightStat.isFile() && dayStat.isFile());
  assert.match(homepage, /html\[data-theme="light"\]\s*\{[\s\S]*?color-scheme:light/);
  assert.match(homepage, /--amber:#2f7818/);
  assert.match(nightLogo, /fill="#9cff57"/);
  assert.match(dayLogo, /fill="#2f7818"/);
});

test("daylight switches both IronPulse placements to the black-on-white master", async () => {
  const [homepage, nightLogo, dayLogo, dayStat] = await Promise.all([
    readFile(homepageUrl, "utf8"),
    readFile(ironPulseNightUrl, "utf8"),
    readFile(ironPulseDayUrl, "utf8"),
    stat(ironPulseDayUrl),
  ]);
  const ironPulseImages = [...homepage.matchAll(/<img\b[^>]*data-logo-night=["']\/assets\/ironpulse-logo\.svg["'][^>]*>/gi)]
    .map((match) => match[0]);

  assert.ok(dayStat.isFile(), "daylight IronPulse master is missing");
  assert.equal(ironPulseImages.length, 2, "About and Currently must use the same theme-aware IronPulse mark");
  for (const image of ironPulseImages) {
    assert.equal(attribute(image, "src"), "/assets/ironpulse-logo.svg");
    assert.equal(attribute(image, "data-logo-night"), "/assets/ironpulse-logo.svg");
    assert.equal(attribute(image, "data-logo-day"), "/assets/ironpulse-logo-day.svg");
  }

  assert.match(nightLogo, /fill="#FFFFFF"/);
  assert.match(nightLogo, /fill="#61C4E3"/);
  assert.match(dayLogo, /<rect\b[^>]*fill="#FFFFFF"/);
  assert.equal((dayLogo.match(/<path\b[^>]*fill="#0A0F0C"/g) || []).length, 4);
  assert.doesNotMatch(dayLogo, /fill="#61C4E3"/);
});

test("daylight player uses paper chrome in rest, hover, and compact layouts", async () => {
  const homepage = await readFile(homepageUrl, "utf8");
  const play = homepage.match(/html\[data-theme="light"\] \.show-play\{([^}]*)\}/)?.[1];
  const duration = homepage.match(/html\[data-theme="light"\] \.show-duration\{([^}]*)\}/)?.[1];
  const hover = homepage.match(/html\[data-theme="light"\] \.show-feature:hover \.show-play,\s*html\[data-theme="light"\] \.show-feature:focus-visible \.show-play\{([^}]*)\}/)?.[1];

  assert.ok(play, "daylight play control rule is missing");
  assert.match(play, /color:#0a0f0c/);
  assert.match(play, /background:rgba\(247,249,244,\.92\)/);
  assert.match(play, /border-color:rgba\(10,15,12,\.40\)/);
  assert.doesNotMatch(play, /rgba\(8,11,10/);

  assert.ok(duration, "daylight duration chip rule is missing");
  assert.match(duration, /color:#0a0f0c/);
  assert.match(duration, /background:rgba\(247,249,244,\.86\)/);

  assert.ok(hover, "daylight hover and keyboard-focus player rule is missing");
  assert.match(hover, /background:rgba\(255,255,255,\.97\)/);
  assert.match(hover, /border-color:rgba\(47,120,24,\.62\)/);

  assert.match(homepage, /\.show-play\{[\s\S]*?width:76px;[\s\S]*?height:76px/);
  assert.match(homepage, /\.show-play svg\{[\s\S]*?width:34px;[\s\S]*?height:34px/);
  assert.match(homepage, /@media \(max-width:600px\)[\s\S]*?\.show-play\{width:64px;height:64px\}/);
  assert.match(homepage, /@media \(max-width:600px\)[\s\S]*?\.show-play svg\{width:30px;height:30px\}/);
  assert.match(homepage, /@media \(max-width:1050px\)\{[\s\S]*?html\[data-theme="light"\] \.show-cover::before/);
});

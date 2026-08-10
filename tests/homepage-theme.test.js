import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const homepageUrl = new URL("index.html", root);
const nightLogoUrl = new URL("assets/hx-logo-icon-v6-xbridge.svg", root);
const dayLogoUrl = new URL("assets/hx-logo-icon-v6-xbridge-day.svg", root);

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

test("theme is restored before CSS and uses a homepage-scoped preference", async () => {
  const homepage = await readFile(homepageUrl, "utf8");
  const styleIndex = homepage.indexOf("<style>");
  const prepaintIndex = homepage.indexOf("var key = 'harryxin-theme'");

  assert.ok(prepaintIndex > -1 && prepaintIndex < styleIndex, "saved theme must be restored before CSS is parsed");
  assert.match(homepage, /localStorage\.getItem\(key\)/);
  assert.match(homepage, /localStorage\.setItem\(KEY, theme\)/);
  assert.doesNotMatch(homepage, /localStorage\.(?:getItem|setItem)\(\s*['"]theme['"]/, "generic theme storage would collide with other pages");
  assert.match(homepage, /saved !== 'light' && saved !== 'dark'/, "stored values must be validated");
  assert.match(homepage, /prefers-color-scheme:light/, "first visit should follow the system color scheme");
});

test("manual theme keeps page chrome and brand assets in sync", async () => {
  const homepage = await readFile(homepageUrl, "utf8");

  assert.match(homepage, /id="theme-color"/);
  assert.match(homepage, /id="site-favicon"/);
  assert.match(homepage, /data-logo-night="\.\/assets\/hx-logo-mark-v6-xbridge\.svg"/);
  assert.match(homepage, /data-logo-day="\.\/assets\/hx-logo-mark-v6-xbridge-day\.svg"/);
  assert.match(homepage, /brand\.setAttribute\('src', theme === 'light'/);
  assert.match(homepage, /favicon\.setAttribute\('href', theme === 'light'/);
  assert.match(homepage, /themeColor\.setAttribute\('content', theme === 'light'/);
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

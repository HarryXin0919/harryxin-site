import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function openingTags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) || [];
}

function relIncludes(tag, value) {
  return (attribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes(value);
}

function pngDimensions(buffer) {
  assert.ok(buffer.subarray(0, 8).equals(pngSignature), "asset must be a PNG");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("homepage advertises the approved HX icon across browser, Windows, and Apple install paths", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const links = openingTags(homepage, "link");
  const icons = links.filter((tag) => relIncludes(tag, "icon"));
  const touchIcon = links.find((tag) => relIncludes(tag, "apple-touch-icon"));
  const manifest = links.find((tag) => relIncludes(tag, "manifest"));

  assert.ok(icons.some((tag) => attribute(tag, "href") === "/favicon.ico?v=7"));
  assert.ok(icons.some((tag) => attribute(tag, "href") === "/assets/favicon-32x32.png?v=7"));
  assert.ok(
    icons.some((tag) => /(?:^|\/)assets\/hx-logo-icon-v6-xbridge\.svg\?v=7$/.test(attribute(tag, "href") || "")),
  );
  assert.equal(attribute(touchIcon, "href"), "/assets/apple-touch-icon.png?v=7");
  assert.equal(attribute(touchIcon, "sizes"), "180x180");
  assert.equal(attribute(manifest, "href"), "/site.webmanifest?v=7");
  assert.match(homepage, /name="application-name" content="Harry Xin"/);
  assert.match(homepage, /name="apple-mobile-web-app-title" content="Harry Xin"/);
  assert.match(homepage, /hx-logo-icon-v6-xbridge-day\.svg\?v=7/);
});

test("manifest supplies stable any and maskable HX app icons", async () => {
  const manifest = JSON.parse(await readFile(new URL("site.webmanifest", root), "utf8"));

  assert.equal(manifest.name, "Harry Xin");
  assert.equal(manifest.short_name, "Harry Xin");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#080c0a");
  assert.equal(manifest.theme_color, "#080b0a");
  assert.deepEqual(
    manifest.icons.map(({ sizes, purpose }) => [sizes, purpose]),
    [
      ["192x192", "any"],
      ["512x512", "any"],
      ["192x192", "maskable"],
      ["512x512", "maskable"],
    ],
  );

  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    const filePath = icon.src.split("?")[0].replace(/^\//, "");
    const file = await readFile(new URL(filePath, root));
    const expected = Number(icon.sizes.split("x")[0]);
    assert.deepEqual(pngDimensions(file), [expected, expected]);
    assert.ok(file.length > 3000, `${filePath} looks empty or truncated`);
  }
});

test("raster and ICO fallbacks contain every declared install size", async () => {
  const pngs = [
    ["assets/favicon-32x32.png", 32],
    ["assets/apple-touch-icon.png", 180],
    ["assets/hx-app-icon-192.png", 192],
    ["assets/hx-app-icon-512.png", 512],
    ["assets/hx-app-icon-maskable-192.png", 192],
    ["assets/hx-app-icon-maskable-512.png", 512],
  ];
  for (const [path, size] of pngs) {
    const file = await readFile(new URL(path, root));
    assert.deepEqual(pngDimensions(file), [size, size], `${path} has the wrong dimensions`);
  }

  const ico = await readFile(new URL("favicon.ico", root));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  assert.equal(count, 4);
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + (index * 16);
    const width = ico[entry] || 256;
    const height = ico[entry + 1] || 256;
    const byteLength = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.equal(width, height);
    assert.ok(offset + byteLength <= ico.length, "ICO image entry exceeds file bounds");
    assert.ok(ico.subarray(offset, offset + 8).equals(pngSignature), "ICO entries must embed PNG data");
    sizes.push(width);
  }
  assert.deepEqual(sizes, [16, 32, 48, 256]);
});

test("all site entry pages expose the complete HX browser and install icon set", async () => {
  const pages = [
    "index.html",
    "projects/finditem/index.html",
    "rlcard/index.html",
    "rlcard/research/index.html",
  ];
  for (const page of pages) {
    const html = await readFile(new URL(page, root), "utf8");
    const links = openingTags(html, "link");
    const icons = links.filter((tag) => relIncludes(tag, "icon"));
    const touchIcon = links.find((tag) => relIncludes(tag, "apple-touch-icon"));
    const manifest = links.find((tag) => relIncludes(tag, "manifest"));

    assert.doesNotMatch(html, /href=["']\/assets\/favicon\.svg/);
    assert.ok(
      icons.some((tag) => attribute(tag, "href") === "/favicon.ico?v=7"),
      `${page} is missing the ICO fallback`,
    );
    assert.ok(
      icons.some((tag) => attribute(tag, "href") === "/assets/favicon-32x32.png?v=7"),
      `${page} is missing the 32px PNG fallback`,
    );
    assert.ok(
      icons.some((tag) => /(?:^|\/)assets\/hx-logo-icon-v6-xbridge\.svg\?v=7$/.test(attribute(tag, "href") || "")),
      `${page} is missing the HX SVG favicon`,
    );
    assert.ok(
      html.indexOf("/assets/favicon-32x32.png?v=7") > html.indexOf("/assets/hx-logo-icon-v6-xbridge.svg?v=7"),
      `${page} must leave the raster favicon after SVG so iOS Chrome can prefer the compatible candidate`,
    );
    assert.equal(
      attribute(touchIcon || "", "href"),
      "/assets/apple-touch-icon.png?v=7",
      `${page} is missing the Apple touch icon`,
    );
    assert.equal(attribute(touchIcon || "", "sizes"), "180x180");
    assert.equal(
      attribute(manifest || "", "href"),
      "/site.webmanifest?v=7",
      `${page} is missing the web app manifest`,
    );
  }

  const legacy = await readFile(new URL("assets/favicon.svg", root), "utf8");
  assert.doesNotMatch(legacy, />H<\/text>/);
  assert.match(legacy, /Harry Xin X-Bridge icon/);
  assert.match(legacy, /fill="#9cff57"/);
  assert.ok((await stat(new URL("favicon.ico", root))).isFile());
});

test("fixture server returns install assets with browser-compatible MIME types", async () => {
  const server = await readFile(new URL("scripts/dev-server.js", root), "utf8");
  assert.match(server, /"\.ico": "image\/x-icon"/);
  assert.match(server, /"\.png": "image\/png"/);
  assert.match(server, /"\.webmanifest": "application\/manifest\+json; charset=utf-8"/);
});

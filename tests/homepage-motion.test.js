import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function openingTags(source, tagNames = ["a"]) {
  const names = tagNames.join("|");
  return Array.from(source.matchAll(new RegExp(`<(?:${names})\\b[^>]*>`, "gi")), (match) => ({
    index: match.index,
    tag: match[0],
  }));
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function hasAttribute(tag, name) {
  return new RegExp(`\\b${name}(?=\\s|=|/?>)`, "i").test(tag);
}

function hasClass(tag, className) {
  const classValue = attribute(tag, "class");
  return classValue ? classValue.split(/\s+/).includes(className) : false;
}

function tagsWithClass(source, className, tagNames = ["a"]) {
  return openingTags(source, tagNames).filter(({ tag }) => hasClass(tag, className));
}

function assertDestinationLabel(tag, description) {
  assert.ok(hasAttribute(tag, "data-destination"), `${description} is missing data-destination`);
  const destination = attribute(tag, "data-destination");
  assert.ok(destination, `${description} has an empty data-destination`);
  assert.match(
    destination,
    /^[A-Z0-9][A-Z0-9 .+&@/:'()_-]*$/,
    `${description} must use a human-readable uppercase English destination label`,
  );
}

function assertMotionGroup(source, {
  className,
  count,
  contract,
  destinations,
  description,
}) {
  const targets = tagsWithClass(source, className);
  assert.equal(targets.length, count, `${description} target count changed unexpectedly`);

  for (const [index, { tag }] of targets.entries()) {
    const targetDescription = `${description} ${index + 1}`;
    assert.ok(
      hasAttribute(tag, contract),
      `${targetDescription} is missing ${contract}`,
    );
    assertDestinationLabel(tag, targetDescription);
    assert.equal(
      attribute(tag, "data-destination"),
      destinations[index],
      `${targetDescription} exposes the wrong destination label`,
    );
  }
}

test("all destination surfaces and CTAs opt into the motion contract", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  const groups = [
    {
      className: "social",
      count: 4,
      contract: "data-motion-surface",
      destinations: ["BILIBILI", "YOUTUBE", "INSTAGRAM", "GITHUB"],
      description: "hero social",
    },
    {
      className: "fact-link",
      count: 2,
      contract: "data-motion-surface",
      destinations: ["IB DIPLOMA", "IRONPULSE"],
      description: "linked fact",
    },
    {
      className: "card",
      count: 6,
      contract: "data-motion-surface",
      destinations: ["FACTLENS", "FINDITEM", "VIRALENS", "LOOMING", "SKILLTREE", "CTXTAX"],
      description: "linked project card",
    },
    {
      className: "show-feature",
      count: 2,
      contract: "data-motion-surface",
      destinations: ["YOUTUBE VIDEO", "BILIBILI VIDEO"],
      description: "media feature",
    },
    {
      className: "arr-link",
      count: 1,
      contract: "data-motion-cta",
      destinations: ["GITHUB"],
      description: "section CTA",
    },
    {
      className: "signal-link",
      count: 1,
      contract: "data-motion-cta",
      destinations: ["RLCARD PHASE I"],
      description: "signal CTA",
    },
    {
      className: "footer-social",
      count: 4,
      contract: "data-motion-cta",
      destinations: ["BILIBILI", "YOUTUBE", "INSTAGRAM", "GITHUB"],
      description: "footer social CTA",
    },
  ];

  for (const group of groups) assertMotionGroup(homepage, group);

  const rlcardLinksMatch = homepage.match(
    /<div class="rlcard-project-links">([\s\S]*?)<\/div>/,
  );
  assert.ok(rlcardLinksMatch, "RLCard project CTA group is missing");
  const rlcardLinks = openingTags(rlcardLinksMatch[1]);
  assert.equal(rlcardLinks.length, 2, "RLCard project CTA count changed unexpectedly");
  for (const [index, { tag }] of rlcardLinks.entries()) {
    const description = `RLCard project CTA ${index + 1}`;
    assert.ok(hasAttribute(tag, "data-motion-cta"), `${description} is missing data-motion-cta`);
    assertDestinationLabel(tag, description);
    assert.equal(
      attribute(tag, "data-destination"),
      ["RLCARD PHASE II", "RLCARD PHASE I"][index],
      `${description} exposes the wrong destination label`,
    );
  }
});

test("Creating precedes Building and features the verified summer-school video", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const navMatch = homepage.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
  assert.ok(navMatch, "section navigation is missing");
  assert.ok(
    navMatch[0].indexOf('href="#creating"') < navMatch[0].indexOf('href="#building"'),
    "Creating must appear before Work in section navigation",
  );

  const creatingIndex = homepage.indexOf('<section id="creating"');
  const buildingIndex = homepage.indexOf('<section id="building"');
  assert.ok(creatingIndex >= 0, "Creating section is missing");
  assert.ok(buildingIndex >= 0, "Building section is missing");
  assert.ok(creatingIndex < buildingIndex, "Creating must appear before Building in document order");

  const creatingMatch = homepage.match(/<section id="creating"[\s\S]*?<\/section>/);
  assert.ok(creatingMatch, "Creating section markup is missing");
  assert.match(creatingMatch[0], /data-num="03"/, "Creating section number must match its new position");
  assert.match(creatingMatch[0], /class="media-grid"/, "Creating videos must share the responsive media grid");
  assert.match(
    creatingMatch[0],
    /href="https:\/\/www\.youtube\.com\/watch\?v=aE1tZ9RmhG0"/,
    "verified summer-school game video URL is missing",
  );
  assert.match(
    creatingMatch[0],
    /src="https:\/\/i\.ytimg\.com\/vi\/aE1tZ9RmhG0\/maxresdefault\.jpg"/,
    "verified summer-school video thumbnail is missing",
  );
});

test("informational panels do not advertise a false navigation affordance", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const nowSectionMatch = homepage.match(/<section id="now"[\s\S]*?<\/section>/);
  assert.ok(nowSectionMatch, "Currently section is missing");

  const factTags = tagsWithClass(nowSectionMatch[0], "fact", ["a", "div"]);
  const nonLinkFacts = factTags.filter(({ tag }) => /^<div\b/i.test(tag));
  assert.equal(nonLinkFacts.length, 1, "FindItem should remain the sole non-link fact block");
  assert.match(
    nowSectionMatch[0].slice(nonLinkFacts[0].index, nonLinkFacts[0].index + 700),
    /FindItem/,
    "the non-link fact block should remain FindItem",
  );

  const excluded = [
    { className: "fact", entry: nonLinkFacts[0], description: "FindItem fact" },
    {
      className: "card-rlcard",
      entry: tagsWithClass(homepage, "card-rlcard", ["article"])[0],
      description: "RLCard research panel",
    },
    {
      className: "lab-signal",
      entry: tagsWithClass(homepage, "lab-signal", ["div"])[0],
      description: "RLCard signal panel",
    },
  ];

  for (const { entry, description } of excluded) {
    assert.ok(entry, `${description} is missing`);
    assert.ok(!hasAttribute(entry.tag, "data-motion-surface"), `${description} must not be a motion surface`);
    assert.ok(!hasAttribute(entry.tag, "data-motion-cta"), `${description} must not be a motion CTA`);
    assert.ok(!hasAttribute(entry.tag, "data-destination"), `${description} must not declare a destination`);
  }
});

test("route motion lasts 420ms and reduced motion navigates without delay", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  const hasCssRouteDuration =
    /--[\w-]*route[\w-]*\s*:\s*420ms\b/i.test(homepage)
    || /(?:is-routing|is-leaving|route-exit|route-leaving)[^{]*\{[^}]*(?:animation|transition)[^;}]*420ms\b/is.test(homepage);
  assert.ok(hasCssRouteDuration, "route exit animation must visibly last 420ms");

  assert.match(
    homepage,
    /\b(?:ROUTE[\w$]*|route[\w$]*(?:Delay|Duration|Ms))\s*=\s*420\b/i,
    "routing code must use a 420ms navigation delay",
  );
  assert.match(homepage, /(?:dataset\.destination|getAttribute\(["']data-destination["']\))/);
  assert.match(homepage, /(?:window\.)?setTimeout\s*\(/);
  assert.match(
    homepage,
    /(?:window\.)?location\.(?:assign|replace)\s*\(|(?:window\.)?location\.href\s*=/,
    "route transition must eventually commit the destination",
  );

  const reducedMotionUsesZeroDelay =
    /(?:reduce|reducedMotion|prefersReducedMotion)[^;\n]{0,180}\?\s*0\s*:\s*(?:420|[A-Za-z_$][\w$]*)/i.test(homepage)
    || /if\s*\(\s*(?:reduce|reducedMotion|prefersReducedMotion)\s*\)\s*\{[\s\S]{0,260}?(?:location\.(?:assign|replace)|location\.href\s*=|navigate\w*\s*\()/i.test(homepage);
  assert.ok(reducedMotionUsesZeroDelay, "prefers-reduced-motion must navigate with zero delay");
});

test("reveal and interaction transforms are composed instead of competing", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const transformDeclarations = Array.from(
    homepage.matchAll(/\btransform\s*:\s*([^;}]+)/gi),
    (match) => match[1],
  );
  const composedTransform = transformDeclarations.find((value) => [
    "--reveal-y",
    "--hover-y",
    "--press-scale",
    "--tilt-x",
    "--tilt-y",
  ].every((token) => value.includes(token)));

  assert.ok(
    composedTransform,
    "motion surfaces must compose reveal, hover, press, and pointer tilt in one transform",
  );
  assert.doesNotMatch(
    homepage,
    /html\.js-reveal\s+\.rise\.in\s*\{[^}]*\btransform\s*:\s*none\b/is,
    "the broad .rise.in rule must not erase surface interaction transforms",
  );
});

test("legacy styles cannot override CTA, boot, tilt, or keyboard reveal states", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  const legacyStateRules = [
    [/\.rlcard-project-links\s+a:hover,[\s\S]*?\{([^}]*)\}/i, "RLCard CTA"],
    [/\.signal-link:hover,[\s\S]*?\{([^}]*)\}/i, "signal CTA"],
    [/\.footer-social:hover\s*\{([^}]*)\}/i, "footer CTA hover"],
    [/\.footer-social:active\s*\{([^}]*)\}/i, "footer CTA press"],
  ];
  for (const [pattern, description] of legacyStateRules) {
    const match = homepage.match(pattern);
    assert.ok(match, `${description} state rule is missing`);
    assert.doesNotMatch(match[1], /\btransform\s*:/i, `${description} must use the shared CTA transform variables`);
  }

  for (const animationName of ["hx-grid-in", "hx-atmo-in", "hx-watermark-in"]) {
    const match = homepage.match(new RegExp(`@keyframes\\s+${animationName}\\s*\\{([^}]*(?:\\}[^}]*)?)\\}`, "i"));
    assert.ok(match, `${animationName} is missing`);
    assert.doesNotMatch(match[0], /to\s*\{\s*opacity\s*:/i, `${animationName} must settle to the element's underlying opacity`);
  }

  assert.match(homepage, /\.is-tilting\s*\{[^}]*transition-property\s*:[^}]*\}/is);
  assert.match(homepage, /addEventListener\(['"]focusin['"][\s\S]{0,500}focus-reveal[\s\S]{0,200}reveal-complete/i);
});

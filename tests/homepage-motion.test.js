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
      className: "about-area",
      count: 4,
      contract: "data-motion-surface",
      destinations: ["TABLE TENNIS MEDIA", "IRONPULSE", "GITHUB PROJECTS", "CONTENT CREATOR"],
      description: "about module",
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

test("section navigation, document order, and numbering stay aligned", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const navMatch = homepage.match(/<nav class="site-nav"[\s\S]*?<\/nav>/);
  assert.ok(navMatch, "section navigation is missing");
  assert.deepEqual(
    openingTags(navMatch[0]).map(({ tag }) => attribute(tag, "href")),
    ["#about", "#creating", "#now", "#building"],
    "section navigation order changed",
  );

  const sectionTags = Array.from(
    homepage.matchAll(/<section\s+id="(about|creating|now|building)"[^>]*>/g),
    (match) => ({ id: match[1], index: match.index, tag: match[0] }),
  );
  assert.deepEqual(
    sectionTags.map(({ id }) => id),
    ["about", "creating", "now", "building"],
    "section document order changed",
  );

  const expected = {
    about: { number: "01", name: "ABOUT" },
    creating: { number: "02", name: "CREATING" },
    now: { number: "03", name: "CURRENTLY" },
    building: { number: "04", name: "BUILDING" },
  };
  for (const section of sectionTags) {
    const contract = expected[section.id];
    assert.equal(attribute(section.tag, "data-num"), contract.number, `${section.id} data-num is wrong`);
    assert.equal(attribute(section.tag, "data-name"), contract.name, `${section.id} data-name is wrong`);
    const headingMarkup = homepage.slice(section.index, section.index + 500);
    const visibleNumber = headingMarkup.match(/class="num"[^>]*>(\d{2})<\/span>/);
    assert.ok(visibleNumber, `${section.id} visible section number is missing`);
    assert.equal(visibleNumber[1], contract.number, `${section.id} visible number disagrees with data-num`);
  }

  const creatingMatch = homepage.match(/<section id="creating"[\s\S]*?<\/section>/);
  assert.ok(creatingMatch, "Creating section markup is missing");
  assert.match(creatingMatch[0], /class="media-grid"/, "Creating videos must share the responsive media grid");
  assert.doesNotMatch(
    creatingMatch[0],
    /class="(?:show-meta|show-title)"/,
    "Creating videos should not reintroduce decorative micro-label rows",
  );
  assert.deepEqual(
    Array.from(creatingMatch[0].matchAll(/class="show-duration"[^>]*>([^<]+)</g), (match) => match[1]),
    ["01:08", "24:31"],
    "Creating covers should retain useful duration labels after decorative metadata is removed",
  );
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

  const factCounter = homepage.match(/\.fact::after\s*\{[^}]*content\s*:\s*"(\d{2})\."/i);
  assert.ok(factCounter, "Currently fact counter prefix is missing");
  assert.equal(factCounter[1], expected.now.number, "Currently card numbers must follow section 03");
});

test("the sticky navigation dissolves into the page instead of becoming a boxed strip", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  assert.match(
    homepage,
    /\.topbar::before\s*\{[^}]*inset:0 -24px -20px[^}]*background:linear-gradient\([^}]*mask-image:linear-gradient\(90deg,transparent 0,#000 5%,#000 95%,transparent 100%\)/,
    "the sticky navigation should feather its material into the page canvas",
  );
  assert.match(
    homepage,
    /html\.is-scrolled \.topbar\s*\{[^}]*border:0[^}]*background:transparent[^}]*box-shadow:none/,
    "the scrolled navigation must not restore a solid framed rectangle",
  );
  assert.match(
    homepage,
    /\.site-nav a\[aria-current="location"\]\s*\{[^}]*border:0[^}]*background:transparent/,
    "the current section should use the precision marker rather than a filled green box",
  );
});

test("About is a four-part clickable index with evidence-led destinations", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const aboutMatch = homepage.match(/<section id="about"[\s\S]*?<\/section>/);
  assert.ok(aboutMatch, "About section markup is missing");
  assert.match(
    homepage,
    /--zh-sans:"PingFang SC"[\s\S]*?html\.lang-zh #about \[data-lang="zh"\]\s*\{\s*font-family:var\(--zh-sans\)/,
    "About Chinese copy must use the modern sans-serif font stack",
  );
  assert.doesNotMatch(
    homepage,
    /html\.lang-zh \.(?:about-intro|about-area h3|about-copy)[^{]*\{[^}]*font-family:var\(--zh-serif\)/,
    "About Chinese typography must not fall back to the serif stack",
  );

  const modules = tagsWithClass(aboutMatch[0], "about-area");
  assert.equal(modules.length, 4, "About must expose exactly four clickable modules");
  assert.deepEqual(
    modules.map(({ tag }) => attribute(tag, "href")),
    [
      "https://www.instagram.com/harryalexanderxin/",
      "https://www.ironpulse.net/",
      "#building",
      "#creating",
    ],
    "About module destinations no longer match the four-part information architecture",
  );

  assert.doesNotMatch(
    aboutMatch[0],
    /class="(?:about-index|about-cta|about-cta-meta)"/,
    "About modules should not reintroduce conflicting micro-label chrome",
  );
  assert.equal(
    tagsWithClass(aboutMatch[0], "about-arrow", ["span"]).length,
    4,
    "each About module should retain one minimal directional affordance",
  );
  assert.doesNotMatch(aboutMatch[0], /\bthree things\b|三件事/i);

  for (const [index, { tag }] of modules.entries()) {
    assert.ok(/^<a\b/i.test(tag), `About module ${index + 1} must keep native link semantics`);
    assert.ok(hasAttribute(tag, "data-motion-surface"), `About module ${index + 1} is missing motion feedback`);
    assertDestinationLabel(tag, `About module ${index + 1}`);
  }

  assert.match(
    aboutMatch[0],
    /class="about-robotics-stage"/,
    "Robotics needs the monumental poster stage",
  );
  assert.match(
    aboutMatch[0],
    /With FRC 6941 IronPulse, I build and iterate competition robots, then help turn that work into calm execution under match pressure\./,
    "Robotics needs the approved concise English role statement",
  );
  assert.match(
    aboutMatch[0],
    /在 FRC 6941 IronPulse，我参与竞赛机器人的研发与迭代，并把工程推进转化为赛场压力下的稳定执行。/,
    "Robotics needs the approved concise Chinese role statement",
  );
  assert.match(
    aboutMatch[0],
    /class="about-robotics-number" aria-hidden="true">6941<\/strong>/,
    "Robotics must retain 6941 as its decorative visual anchor",
  );
  assert.match(
    aboutMatch[0],
    /class="about-robotics-logo"[^>]*alt=""[^>]*aria-hidden="true"/,
    "the IronPulse seal must remain decorative to assistive technology",
  );
  assert.match(
    aboutMatch[0],
    /Shanghai Regional Champions[\s\S]*?Houston Worlds/,
    "Robotics needs the consolidated English competition result",
  );
  assert.match(
    aboutMatch[0],
    /上海区域赛冠军[\s\S]*?休斯顿世界赛/,
    "Robotics needs the consolidated Chinese competition result",
  );
  assert.doesNotMatch(
    aboutMatch[0],
    /about-work-(?:list|row)|>BUILD<|>TEAM<|>RESULT</,
    "Robotics must not restore the old micro-label table",
  );
  assert.doesNotMatch(
    homepage,
    /\.about-work-(?:list|row)\b/,
    "obsolete Robotics table styles must be removed",
  );
  assert.match(
    homepage,
    /\.about-robotics-stage\{[^}]*min-height:230px/,
    "the desktop Robotics poster stage must retain its monumental height",
  );
  assert.match(
    homepage,
    /\.about-robotics-number\{[^}]*clamp\(118px,12\.2vw,184px\)/,
    "6941 must remain the dominant responsive visual",
  );
  assert.match(
    homepage,
    /\.about-robotics::before\{display:none\}/,
    "Robotics must not inherit the generic green sweep overlay",
  );

  assert.match(aboutMatch[0], /class="[^"]*\babout-repo-preview\b[^"]*"/, "GitHub module needs project summary rows");
  assert.match(aboutMatch[0], /class="[^"]*\babout-video-preview\b[^"]*"/, "Content Creator module needs the two-video preview");
  assert.match(aboutMatch[0], /aE1tZ9RmhG0/, "Content Creator module is missing the summer-school video");
  assert.match(aboutMatch[0], /cross-club-variety-cover\.jpg/, "Content Creator module is missing the Bilibili video");
});

test("the Bilibili cover follows the selected site language", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const englishCover = await readFile(
    new URL("assets/cross-club-variety-cover-en-16x9.jpg", root),
  );
  assert.ok(englishCover.byteLength > 100_000, "the local English cover asset is missing or unexpectedly small");

  const localizedCovers = tagsWithClass(homepage, "localized-video-cover", ["img"]);
  assert.equal(localizedCovers.length, 2, "About and Creating must both use the localized Bilibili cover");
  for (const [index, { tag }] of localizedCovers.entries()) {
    assert.equal(
      attribute(tag, "src"),
      "/assets/cross-club-variety-cover-en-16x9.jpg",
      `localized cover ${index + 1} must default to English`,
    );
    assert.equal(
      attribute(tag, "data-cover-en"),
      "/assets/cross-club-variety-cover-en-16x9.jpg",
      `localized cover ${index + 1} is missing its English source`,
    );
    assert.equal(
      attribute(tag, "data-cover-zh"),
      "/assets/cross-club-variety-cover.jpg",
      `localized cover ${index + 1} is missing its Chinese source`,
    );
    assert.equal(attribute(tag, "width"), "1600", `localized cover ${index + 1} must declare a 16:9 width`);
    assert.equal(attribute(tag, "height"), "900", `localized cover ${index + 1} must declare a 16:9 height`);
  }

  assert.match(
    homepage,
    /document\.querySelectorAll\('\[data-cover-en\]\[data-cover-zh\]'\)/,
    "the language switch must update localized cover sources",
  );
  assert.doesNotMatch(
    homepage,
    /img\.localized-video-cover\s*\{[^}]*object-fit\s*:\s*contain/,
    "localized covers must fill their matching 16:9 frames instead of appearing inset",
  );
  assert.match(
    homepage,
    /html\[lang\^="en"\] img\.localized-video-cover\s*\{[^}]*top:-5%[^}]*left:-7%[^}]*width:114%[^}]*height:114%/,
    "the English cover should use a restrained upper-biased crop that hides the generated lower legs",
  );
});

test("project cards preserve public sources while FindItem opens its internal case study", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const buildingMatch = homepage.match(/<section id="building"[\s\S]*?<\/section>/);
  assert.ok(buildingMatch, "Building section markup is missing");

  const projectCards = tagsWithClass(buildingMatch[0], "card");
  assert.deepEqual(
    projectCards.map(({ tag }) => attribute(tag, "href")),
    [
      "https://github.com/HarryXin0919/factlens",
      "/projects/finditem",
      "https://github.com/HarryXin0919/viralens",
      "https://github.com/HarryXin0919/looming",
      "https://github.com/HarryXin0919/skilltree",
      "https://github.com/HarryXin0919/ctxtax",
    ],
    "only FindItem should route through the internal portfolio case study",
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

  for (const animationName of ["hx-grid-in", "hx-atmo-in"]) {
    const match = homepage.match(new RegExp(`@keyframes\\s+${animationName}\\s*\\{([^}]*(?:\\}[^}]*)?)\\}`, "i"));
    assert.ok(match, `${animationName} is missing`);
    assert.doesNotMatch(match[0], /to\s*\{\s*opacity\s*:/i, `${animationName} must settle to the element's underlying opacity`);
  }

  for (const animationName of [
    "hx-chrome-in",
    "hx-signal-sweep",
    "hx-lock-field",
    "hx-lock-h",
    "hx-lock-x",
    "hx-lock-slash",
  ]) {
    assert.match(homepage, new RegExp(`@keyframes\\s+${animationName}\\b`, "i"), `${animationName} is missing`);
  }
  assert.match(
    homepage,
    /<span class="watermark hx-lock"[^>]*><span class="hx-lock__h">H<\/span><span class="hx-lock__slash">\/<\/span><span class="hx-lock__x">X<\/span><\/span>/i,
    "the H/X signal-lock glyphs must remain decorative and separate from the hero title",
  );
  assert.match(
    homepage,
    /html\.motion-enabled\.is-entering\s+\.hero::before\s*\{[^}]*animation\s*:\s*hx-signal-sweep\b/is,
    "the temporary hero scan must run only during the entrance state",
  );
  assert.match(
    homepage,
    /@media\s*\(prefers-reduced-motion:reduce\)[\s\S]*?\.hero::before\s*\{[^}]*display\s*:\s*none!important/is,
    "reduced-motion mode must suppress the signal scan",
  );

  assert.match(homepage, /\.is-tilting\s*\{[^}]*transition-property\s*:[^}]*\}/is);
  assert.match(homepage, /addEventListener\(['"]focusin['"][\s\S]{0,500}focus-reveal[\s\S]{0,200}reveal-complete/i);
  const heroTitleMotion = homepage.match(/html\.js-reveal\s+\.hero\s+h1\.rise\s*\{([^}]*)\}/i);
  assert.ok(heroTitleMotion, "hero title motion rule is missing");
  const titleTransition = heroTitleMotion[1].match(/transition-property\s*:\s*([^;}]+)/i);
  assert.ok(titleTransition, "hero title transition-property is missing");
  assert.deepEqual(
    titleTransition[1].split(",").map((value) => value.trim()).sort(),
    ["opacity", "transform"],
    "hero title must retain only its full-glyph fade-and-rise motion",
  );
  assert.match(heroTitleMotion[1], /overflow\s*:\s*visible/i, "hero title must expose its complete glyph bounds");
  assert.match(heroTitleMotion[1], /padding-bottom\s*:\s*\.1em/i, "hero title needs Safari descender paint room");
  assert.doesNotMatch(
    homepage,
    /html\.js-reveal\s+\.hero\s+h1[^{]*\{[^}]*(?:clip-path|mask|overflow\s*:\s*hidden)/is,
    "hero title motion must never clip or mask descenders such as Harry's y",
  );
});

test("footer brand and social links blend into the page without a container frame", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const labFooter = homepage.match(
    /footer\s*\{\s*margin-top:\s*18px;[^}]*\}/i,
  );

  assert.ok(labFooter, "the laboratory footer style is missing");
  assert.match(labFooter[0], /\bborder\s*:\s*0\s*;/i);
  assert.match(labFooter[0], /\bbackground\s*:\s*transparent\s*;/i);
  assert.match(labFooter[0], /\bbox-shadow\s*:\s*none\s*;/i);
  assert.doesNotMatch(
    labFooter[0],
    /(?:linear-gradient|rgba?\()/i,
    "the footer must not create a separate tinted surface",
  );
});

test("project cards do not render the legacy circular corner ornament", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const laboratorySkin = homepage.split("RLCard laboratory visual skin")[1];

  assert.ok(laboratorySkin, "the laboratory visual skin is missing");
  assert.match(
    laboratorySkin,
    /\.card::before\s*\{\s*content\s*:\s*none\s*;\s*\}/i,
    "the laboratory skin must suppress the inherited circular card ornament",
  );
});

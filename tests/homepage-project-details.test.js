import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
}

function hasAttribute(tag, name) {
  return new RegExp(`\\b${name}(?=\\s|=|/?>)`, "i").test(tag);
}

function stripMarkup(source) {
  return source.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

function buildingSection(homepage) {
  const match = homepage.match(/<section id="building"[\s\S]*?<section id="settings"/i);
  assert.ok(match, "Building section markup is missing");
  return match[0];
}

function nativeDisclosures(source) {
  return Array.from(source.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/gi), (match) => {
    const summary = match[2].match(/<summary\b([^>]*)>([\s\S]*?)<\/summary>/i);
    return {
      openingTag: `<details${match[1]}>`,
      markup: match[0],
      summaryTag: summary ? `<summary${summary[1]}>` : null,
      summaryMarkup: summary ? summary[2] : "",
      summaryText: summary ? stripMarkup(summary[2]) : "",
    };
  });
}

function destinationLabel(tag, description) {
  assert.ok(hasAttribute(tag, "data-destination"), `${description} is missing data-destination`);
  const label = attribute(tag, "data-destination");
  assert.ok(label, `${description} has an empty data-destination`);
  assert.match(label, /^[A-Z0-9][A-Z0-9 .+&@/:'()_-]*$/, `${description} destination must be readable uppercase English`);
  return label;
}

test("Featured Case Studies expose RLCard, FindItem, and ViraLens as internal detail routes", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const building = buildingSection(homepage);

  const rlcardMarker = building.indexOf('id="rlcard-research-project"');
  assert.ok(rlcardMarker >= 0, "RLCard featured case study is missing");
  const rlcardStart = building.lastIndexOf("<article", rlcardMarker);
  const rlcardEnd = building.indexOf("</article>", rlcardMarker);
  assert.ok(rlcardStart >= 0 && rlcardEnd > rlcardMarker, "RLCard featured case study must remain an article");
  const rlcard = building.slice(rlcardStart, rlcardEnd + "</article>".length);
  assert.match(rlcard, /RLCard Reward Study/i, "RLCard featured case study title is missing");
  assert.match(rlcard, /href="\/rlcard\/research\/?"/, "RLCard featured case study must open the public report");
  assert.equal((rlcard.match(/\bdata-work-detail\b/g) || []).length, 2, "both RLCard detail routes must preserve Work scroll");

  const featuredLinks = Array.from(
    building.matchAll(/<a\b[^>]*href=(["'])(\/projects\/(?:finditem|viralens)\/?)[^"']*\1[^>]*>/gi),
    (match) => ({ tag: match[0], href: match[2] }),
  );
  assert.deepEqual(
    featuredLinks.map(({ href }) => href.replace(/\/$/, "")),
    ["/projects/finditem", "/projects/viralens"],
    "FindItem and ViraLens must be the two internal project case-study cards",
  );
  for (const { tag, href } of featuredLinks) {
    assert.ok(hasAttribute(tag, "data-motion-surface"), `${href} is missing data-motion-surface`);
    assert.ok(hasAttribute(tag, "data-work-detail"), `${href} must preserve the App Work scroll position`);
    destinationLabel(tag, `${href} featured card`);
  }

  assert.match(building, /Featured Case Studies|重点项目|精选案例/i, "featured case-study grouping needs a visible bilingual label");
});

test("supporting projects use four native, keyboard-operable disclosures", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const disclosures = nativeDisclosures(buildingSection(homepage));
  assert.equal(disclosures.length, 4, "supporting projects must use exactly four native details disclosures");

  const expected = [
    { name: "FactLens", destination: "FACTLENS", href: "https://github.com/HarryXin0919/factlens", stack: /PYTHON/i },
    { name: "Looming", destination: "LOOMING", href: "https://github.com/HarryXin0919/looming", stack: /NODE|TYPESCRIPT|CLI/i },
    { name: "SkillTree", destination: "SKILLTREE", href: "https://github.com/HarryXin0919/skilltree", stack: /PYTHON|TYPER/i },
    { name: "ctxtax", destination: "CTXTAX", href: "https://github.com/HarryXin0919/ctxtax", stack: /TYPESCRIPT|NODE|CLI/i },
  ];

  for (const project of expected) {
    const disclosure = disclosures.find(({ summaryText }) => new RegExp(project.name, "i").test(summaryText));
    assert.ok(disclosure, `${project.name} native disclosure is missing`);
    assert.ok(disclosure.summaryTag, `${project.name} must use a native summary trigger`);
    assert.ok(hasAttribute(disclosure.summaryTag, "data-motion-surface"), `${project.name} summary is missing data-motion-surface`);
    assert.equal(destinationLabel(disclosure.summaryTag, `${project.name} summary`), project.destination);
    assert.ok(
      !hasAttribute(disclosure.summaryTag, "aria-expanded"),
      `${project.name} summary must rely on native details state rather than duplicating aria-expanded`,
    );
    assert.match(disclosure.markup, project.stack, `${project.name} disclosure must expose its technical stack`);
    assert.match(
      disclosure.markup,
      /STATUS|ROLE|EVIDENCE|状态|角色|证据/i,
      `${project.name} disclosure must expose status, role, or evidence context`,
    );

    const githubCta = disclosure.markup.match(new RegExp(`<a\\b[^>]*href=(["'])${project.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1[^>]*>`, "i"));
    assert.ok(githubCta, `${project.name} disclosure is missing its independent GitHub CTA`);
    assert.ok(hasAttribute(githubCta[0], "data-motion-cta"), `${project.name} GitHub CTA is missing data-motion-cta`);
    assert.equal(destinationLabel(githubCta[0], `${project.name} GitHub CTA`), `${project.destination} GITHUB`);
  }

  const factlens = disclosures.find(({ summaryText }) => /FactLens/i.test(summaryText));
  assert.match(
    factlens.markup,
    /WIP|EXPERIMENTAL|WORK IN PROGRESS|实验中|开发中/i,
    "FactLens must be visibly labelled WIP or experimental",
  );
});

test("About project copy describes mixed case-study and GitHub destinations honestly", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const aboutMatch = homepage.match(/<section id="about"[\s\S]*?<section id="creating"/i);
  assert.ok(aboutMatch, "About section markup is missing");

  assert.doesNotMatch(
    aboutMatch[0],
    /project cards below link straight to each public repository|下方项目卡会直接进入各自的公开 GitHub 仓库/i,
    "About must not claim that every project card links directly to GitHub",
  );
  assert.match(
    aboutMatch[0],
    /case stud|project detail|details|GitHub|案例|项目详情|展开/i,
    "About must describe the mixed case-study, disclosure, and source-link destinations",
  );
});

test("the mobile Work heading gives its GitHub action a separate row", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  assert.match(
    homepage,
    /@media\s*\(max-width:\s*600px\)[\s\S]*?#building\s+\.shead\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/i,
    "the mobile Work title and GitHub action must not compete for one narrow row",
  );
  assert.match(
    homepage,
    /#building\s+\.shead\s+\.arr-link\s*\{[^}]*justify-self:\s*start[^}]*margin-left:\s*0/i,
    "the Work GitHub action should sit below the title on narrow screens",
  );
});

test("reduced motion removes the disclosure icon rotation", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const reduced = homepage.slice(homepage.lastIndexOf("@media (prefers-reduced-motion:reduce)"));
  assert.match(reduced, /\.project-disclosure summary::after\s*\{[^}]*transition:none!important[^}]*transform:translateY\(-50%\)!important/i);
  assert.match(reduced, /\.project-disclosure\[open\] summary::after\s*\{\s*content:"−"\s*\}/i);
});

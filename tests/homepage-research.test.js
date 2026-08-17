import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function fixture(path) {
  return readFile(new URL(path, root), "utf8");
}

test("homepage presents the completed study before live telemetry arrives", async () => {
  const homepage = await fixture("index.html");

  assert.match(homepage, /id="rlcard-research-project"/);
  assert.match(homepage, /data-research-state="complete"/);
  assert.match(homepage, /RLCard Reward Study · Complete/);
  assert.match(homepage, /id="research-card-runs">20 \/ 20/);
  assert.match(homepage, /Read the public report/);
  assert.match(homepage, /href="\/rlcard\/research\/"/);
  assert.match(homepage, /setInterval\(load, 3000\)/);
  assert.doesNotMatch(homepage, /The Pilot promoted no reward candidate\. A separate 300K extension now/);
});

test("local development fixture does not invent Phase II research telemetry", async () => {
  const devServer = await fixture("scripts/dev-server.js");
  assert.doesNotMatch(devServer, /\bresearch\s*:\s*\{/);
});

test("public report leads with a plain-language answer and one primary comparison", async () => {
  const page = await fixture("rlcard/research/index.html");

  assert.match(page, /<meta name="robots" content="index, follow"/);
  assert.match(page, /把奖励缩小 7 倍/);
  assert.match(page, /没有让扑克 AI 学得更好/);
  assert.match(page, /EXECUTIVE SUMMARY/);
  assert.match(page, /先说结论/);
  assert.match(page, /数字越低，策略越稳/);
  assert.match(page, /10 \/ 10/);
  assert.match(page, /\+10\.0%/);
  assert.match(page, /6,000,000/);
  assert.equal((page.match(/class="comparison-figure"/g) || []).length, 1);

  assert.doesNotMatch(page, /id="phaseDial"/);
  assert.doesNotMatch(page, /class="signal-rail/);
  assert.doesNotMatch(page, /class="arm-grid/);
  assert.doesNotMatch(page, /class="pipeline/);
  assert.doesNotMatch(page, /GPU|COMPUTE NODE/);
});

test("technical language is explained before it is placed in collapsed evidence", async () => {
  const page = await fixture("rlcard/research/index.html");
  const summaryIndex = page.indexOf("EXECUTIVE SUMMARY");
  const technicalIndex = page.indexOf("统计数字（给需要复核的读者）");

  assert.ok(summaryIndex >= 0 && technicalIndex > summaryIndex);
  assert.match(page, /<details class="evidence-details">/);
  assert.match(page, /方法、10 组完整数字与研究限制/);
  assert.match(page, /最后一次运行的真实 CSV 曲线/);
  assert.match(page, /单个设置与随机起点，不是 10 组平均/);
  assert.match(page, /看过前期结果后追加的探索 · 不是预先设定的验证/);
  assert.match(page, /不能充当事先设计的最终验证/);
  assert.match(page, /不能证明所有奖励设计在其他任务里都无效/);
  assert.doesNotMatch(page, /\b300K CONFIRMATION\b/);
});

test("mechanism screening adds a plain-language 2 by 2 live view without replacing Phase 7", async () => {
  const page = await fixture("rlcard/research/index.html");

  assert.match(page, /id="mechanismView"[\s\S]*?hidden/);
  assert.match(page, /奖励变差，是公式的问题，还是因为整体变小了/);
  assert.match(page, /可以把它想成调音量/);
  assert.match(page, /两个开关/);
  assert.match(page, /2 × 2/);
  assert.match(page, /R \/ 7 \+ 0\.25ΔΦ/);
  assert.match(page, /R \+ 1\.75ΔΦ/);
  assert.match(page, /0 \/ 32 组完成/);
  assert.match(page, /单次真实数据/);
  assert.match(page, /不是 8 组平均/);
  assert.match(page, /实验设计、判断规则与运行诊断/);
  assert.match(page, /默认折叠，不影响普通读者理解/);
  assert.match(page, /不是确认性实验/);
  assert.match(page, /不代表已经证明有效/);

  assert.match(page, /id="exploratoryArchive"/);
  assert.match(page, /20 次运行、6,000,000 局/);
});

test("mechanism UI prepares live polling and a frozen report without inventing results", async () => {
  const app = await fixture("rlcard/research/app.js");

  assert.match(app, /mechanism-report-v1\.json/);
  assert.match(app, /post_outcome_mechanism_screening/);
  assert.match(app, /leduc-reward-mechanism-scale-pbrs-v1/);
  assert.match(app, /scaled-pbrs-cfr-a025/);
  assert.match(app, /unscaled-pbrs-cfr-a175/);
  assert.match(app, /statusTimer = globalThis\.setTimeout/);
  assert.match(app, /}, 3000\);/);
  assert.match(app, /训练完成 · 等待冻结报告/);
  assert.match(app, /有一个方案.*还没有被正式确认/);
  assert.doesNotMatch(app, /自动.*Confirmation|automaticConfirmationAuthorized\s*=\s*true/i);
});

test("homepage mechanism card stays compact and reports total rather than per-run progress", async () => {
  const homepage = await fixture("index.html");
  const cardMarker = homepage.indexOf('id="rlcard-research-project"');
  const cardStart = homepage.lastIndexOf("<article", cardMarker);
  const cardEnd = homepage.indexOf("</article>", cardMarker);
  const card = homepage.slice(cardStart, cardEnd + "</article>".length);

  assert.match(card, /id="research-card-summary"/);
  assert.match(card, /id="research-card-phase">07 \/ 09/);
  assert.doesNotMatch(card, /class="research-run-meta"/);
  assert.match(homepage, /Reward Mechanism Screen/);
  assert.match(homepage, /MECHANISM RUNS \/ 机制筛查/);
  assert.match(homepage, /TOTAL MECHANISM PROGRESS/);
  assert.match(homepage, /completedRuns \+ activeFraction/);
  assert.match(homepage, /scaled-pbrs-cfr-a025/);
  assert.match(homepage, /unscaled-pbrs-cfr-a175/);
});

test("versioned report asset is complete, exploratory, and contains no private fields", async () => {
  const source = await fixture("rlcard/research/exploratory-report-v1.json");
  const report = JSON.parse(source);

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.studyId, "leduc-reward-exploratory-scaled-v1");
  assert.equal(report.analysisType, "post_outcome_exploratory");
  assert.equal(report.confirmatory, false);
  assert.equal(report.completedRuns, 20);
  assert.equal(report.totalEpisodes, 6000000);
  assert.equal(report.seeds.length, 10);
  assert.equal(new Set(report.seeds).size, 10);
  assert.equal(report.metrics.finalExploitability.perSeed.length, 10);
  assert.equal(report.metrics.exploitabilityAuc.perSeed.length, 10);
  assert.doesNotMatch(source, /localPath|checkpoint|publisherToken|stderr|stdout|pid|D:\\\\/i);
});

test("homepage keeps exploratory telemetry without duplicating protocol copy", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const cardMarker = homepage.indexOf('id="rlcard-research-project"');
  const cardStart = homepage.lastIndexOf("<article", cardMarker);
  const cardEnd = homepage.indexOf("</article>", cardMarker);
  assert.ok(cardMarker >= 0 && cardStart >= 0 && cardEnd > cardMarker);
  const card = homepage.slice(cardStart, cardEnd + "</article>".length);

  assert.doesNotMatch(card, /class="pd"/);
  assert.doesNotMatch(card, /class="rlcard-amendment"/);
  assert.doesNotMatch(card, /The Pilot promoted no reward candidate/);
  assert.doesNotMatch(card, /Pilot 没有方案晋级/);
  assert.match(homepage, /rawState === 'queued'/);
  assert.match(homepage, /rawState === 'blocked'/);
  assert.match(homepage, /BLOCKED · PREFLIGHT FAILED/);
  assert.match(homepage, /BLOCKED · REPORT FAILED/);
  assert.match(homepage, /REPORT NOT SAVED/);
  assert.match(homepage, /NO GPU START/);
  assert.match(homepage, /BLOCKED · DATA INVALID/);
  assert.match(homepage, /paused && !blocked/);
  assert.match(homepage, /POST-OUTCOME EXPLORATORY/);
  assert.match(homepage, /EXPLORATORY COMPLETION/);
  assert.match(homepage, /LAST COMPLETED RUN \/ 最近完成/);
});

test("frozen latest-run snapshot preserves a real, non-empty completed curve", async () => {
  const snapshot = JSON.parse(await fixture("rlcard/research/latest-run-v1.json"));

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.arm, "terminal");
  assert.equal(snapshot.seed, 23003);
  assert.equal(snapshot.target, 300000);
  assert.equal(snapshot.series.length, 12);
  assert.equal(snapshot.series[0].progress, 25000);
  assert.equal(snapshot.series.at(-1).progress, 300000);
  assert.equal(snapshot.series.at(-1).exploitability, 1.1855280481569292);
  snapshot.series.forEach((point) => {
    assert.equal(Number.isFinite(point.progress), true);
    assert.equal(Number.isFinite(point.exploitability), true);
  });
});

test("public report enhancement loads final data separately from live status", async () => {
  const app = await fixture("rlcard/research/app.js");

  assert.match(app, /exploratory-report-v1\.json/);
  assert.match(app, /latest-run-v1\.json/);
  assert.match(app, /\/api\/rlcard\/status/);
  assert.match(app, /confirmatory !== false/);
  assert.match(app, /scaled_minus_terminal/);
  assert.match(app, /实时状态快照较旧 · 最终报告为 20 \/ 20 组/);
  assert.doesNotMatch(app, /setInterval/);
});

test("homepage inline telemetry renderer remains valid JavaScript", async () => {
  const homepage = await fixture("index.html");
  const inlineScripts = Array.from(
    homepage.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1],
  );

  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source) => {
    assert.doesNotThrow(() => new Function(source));
  });
});

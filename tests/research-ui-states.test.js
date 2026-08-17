import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const appSource = await readFile(new URL("rlcard/research/app.js", root), "utf8");
const frozenReport = JSON.parse(
  await readFile(new URL("rlcard/research/exploratory-report-v1.json", root), "utf8"),
);
const frozenRun = JSON.parse(
  await readFile(new URL("rlcard/research/latest-run-v1.json", root), "utf8"),
);

function createApi() {
  const document = {
    readyState: "loading",
    addEventListener: () => undefined,
    getElementById: () => null,
    createElement: () => null,
    createElementNS: () => null,
  };
  const context = vm.createContext({
    document,
    Intl,
    Date,
    Math,
    Number,
    String,
    Set,
    TypeError,
    console,
    fetch: async () => {
      throw new Error("boot must not run in the pure-function harness");
    },
  });
  vm.runInContext(appSource, context);
  return context.RLCardPublicReport;
}

function researchPayload({
  state = "running",
  runStatus = "running",
  completedRuns = 4,
  phase = 6,
  progress = 150000,
} = {}) {
  return {
    connectionState: "LIVE",
    research: {
      phase,
      state,
      completedRuns,
      totalRuns: 20,
      currentRun: {
        arm: "scaled",
        seed: 31415,
        progress,
        target: 300000,
        status: runStatus,
      },
      series: [],
    },
  };
}

function mechanismPayload({
  state = "running",
  runStatus = "running",
  completedRuns = 3,
  phase = 8,
  progress = 50000,
} = {}) {
  return {
    connectionState: "LIVE",
    research: {
      studyId: "leduc-reward-mechanism-scale-pbrs-v1",
      cohort: "mechanism",
      protocolMode: "post_outcome_mechanism_screening",
      confirmatory: false,
      phase,
      state,
      completedRuns,
      totalRuns: 32,
      currentRun: {
        cohort: "mechanism",
        arm: "scaled-pbrs-cfr-a025",
        seed: 47982,
        progress,
        target: 100000,
        fraction: progress / 100000,
        status: runStatus,
      },
      arms: [],
      series: [],
    },
  };
}

test("frozen report derives the public headline from all ten paired seeds", () => {
  const summary = createApi().summarizeReport(frozenReport);

  assert.equal(summary.completedRuns, 20);
  assert.equal(summary.totalEpisodes, 6000000);
  assert.equal(summary.terminalMean, 1.1795826725434617);
  assert.equal(summary.scaledMean, 1.297517370546144);
  assert.ok(Math.abs(summary.finalWorsePercent - 9.998001899128186) < 1e-12);
  assert.equal(summary.terminalBetterPairs, 10);
  assert.equal(summary.terminalMeanAuc, 328774.2512535824);
  assert.equal(summary.scaledMeanAuc, 358724.0860050282);
  assert.ok(Math.abs(summary.aucWorsePercent - 9.109543900487997) < 1e-12);
  assert.equal(summary.terminalBetterAucPairs, 9);
});

test("report contract rejects confirmatory, non-finite, mismatched, and incomplete data", () => {
  const api = createApi();

  const confirmatory = structuredClone(frozenReport);
  confirmatory.confirmatory = true;
  assert.throws(() => api.summarizeReport(confirmatory), /frozen exploratory report/);

  const nonFinite = structuredClone(frozenReport);
  nonFinite.metrics.finalExploitability.perSeed[0].scaled = null;
  assert.throws(() => api.summarizeReport(nonFinite), /must be finite/);

  const mismatched = structuredClone(frozenReport);
  mismatched.metrics.finalExploitability.perSeed[0].difference = 0;
  assert.throws(() => api.summarizeReport(mismatched), /inconsistent paired difference/);

  const incomplete = structuredClone(frozenReport);
  incomplete.metrics.exploitabilityAuc.perSeed.pop();
  assert.throws(() => api.summarizeReport(incomplete), /one row per seed/);

  const duplicateSeed = structuredClone(frozenReport);
  duplicateSeed.seeds[1] = duplicateSeed.seeds[0];
  assert.throws(() => api.summarizeReport(duplicateSeed), /ten unique integer seeds/);
});

test("saved final report stays authoritative when telemetry is missing or stale", () => {
  const api = createApi();
  api.renderReport(frozenReport);

  assert.deepEqual(
    { ...api.statusCopy(null) },
    {
      state: "complete",
      label: "研究完成 · 报告已保存",
      detail: "20 / 20 组训练 · 共 6,000,000 局",
    },
  );

  const stale = researchPayload({ completedRuns: 19, progress: 166245 });
  stale.connectionState = "OFFLINE";
  assert.deepEqual(
    { ...api.statusCopy(stale) },
    {
      state: "complete",
      label: "研究完成 · 报告已保存",
      detail: "实时状态快照较旧 · 最终报告为 20 / 20 组",
    },
  );
});

test("the frozen Phase 7 report never masks a live mechanism screening", () => {
  const api = createApi();
  api.renderReport(frozenReport);

  assert.deepEqual(
    { ...api.statusCopy(mechanismPayload()) },
    {
      state: "running",
      label: "机制筛查正在训练",
      detail: "3 / 32 组完成 · 当前 50,000 / 100,000",
    },
  );
  assert.equal(
    api.statusCopy(
      mechanismPayload({ state: "reporting", runStatus: "complete", completedRuns: 32, phase: 9, progress: 100000 }),
    ).label,
    "训练完成 · 正在整理报告",
  );
  assert.equal(
    api.statusCopy(
      mechanismPayload({ state: "paused", runStatus: "paused" }),
    ).label,
    "训练已暂停 · 恢复点已保存",
  );

  const stale = mechanismPayload();
  stale.connectionState = "OFFLINE";
  assert.deepEqual(
    { ...api.statusCopy(stale) },
    {
      state: "offline",
      label: "实时更新暂时中断",
      detail: "保留最后一次公开快照 · 3 / 32 组完成 · 当前 50,000 / 100,000",
    },
  );
});

test("mechanism report contract stays complete, frozen, and non-confirmatory", () => {
  const api = createApi();
  const report = {
    schemaVersion: 1,
    studyId: "leduc-reward-mechanism-scale-pbrs-v1",
    sourceStudyId: "leduc-reward-exploratory-scaled-v1",
    analysisType: "post_outcome_mechanism_screening",
    confirmatory: false,
    arms: [
      "terminal",
      "scaled",
      "scaled-pbrs-cfr-a025",
      "unscaled-pbrs-cfr-a175",
    ],
    seeds: [47982, 81425, 45579, 34975, 86195, 68642, 31659, 54386],
    completedRuns: 32,
    totalEpisodes: 3200000,
    metrics: {},
    promotion: {
      status: "no_candidate_advanced",
      selectedArm: null,
      automaticConfirmationAuthorized: false,
    },
    claimLimit: "Exploratory mechanism screening only.",
  };

  const summary = api.summarizeMechanismReport(report);
  assert.equal(summary.status, "no_candidate_advanced");
  assert.equal(summary.selectedArm, null);
  assert.equal(summary.totalEpisodes, 3200000);

  const confirmatory = structuredClone(report);
  confirmatory.confirmatory = true;
  assert.throws(
    () => api.summarizeMechanismReport(confirmatory),
    /non-confirmatory mechanism report/,
  );

  const incomplete = structuredClone(report);
  incomplete.completedRuns = 31;
  assert.throws(
    () => api.summarizeMechanismReport(incomplete),
    /all thirty-two runs/,
  );
});

test("without a final report the compact status remains truthful", () => {
  const api = createApi();

  assert.equal(api.statusCopy(researchPayload()).state, "running");
  assert.equal(
    api.statusCopy(researchPayload({ state: "queued", runStatus: "pending", progress: 0 })).label,
    "研究等待开始",
  );
  assert.equal(
    api.statusCopy(researchPayload({ state: "idle", runStatus: "paused" })).label,
    "研究已暂停 · 恢复点已保存",
  );
  assert.equal(
    api.statusCopy(researchPayload({ state: "blocked", runStatus: "pending" })).label,
    "研究流程受阻",
  );
  assert.equal(
    api.statusCopy(
      researchPayload({
        state: "complete",
        runStatus: "complete",
        phase: 7,
        completedRuns: 20,
        progress: 300000,
      }),
    ).label,
    "研究完成 · 报告已保存",
  );
});

test("frozen CSV snapshot validation rejects altered identity or bad points", () => {
  const api = createApi();
  assert.equal(api.validateRunSnapshot(frozenRun).series.length, 12);

  const wrongRun = structuredClone(frozenRun);
  wrongRun.seed = 42;
  assert.throws(() => api.validateRunSnapshot(wrongRun), /Invalid frozen run snapshot/);

  const badPoint = structuredClone(frozenRun);
  badPoint.series[0].exploitability = "not-a-number";
  assert.throws(() => api.validateRunSnapshot(badPoint), /must be finite/);
});

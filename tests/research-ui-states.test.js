import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const appSource = await readFile(
  new URL("../rlcard/research/app.js", import.meta.url),
  "utf8",
);

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
  }

  values() {
    return new Set(this.owner.className.split(/\s+/).filter(Boolean));
  }

  add(...names) {
    const values = this.values();
    names.forEach((name) => values.add(name));
    this.owner.className = [...values].join(" ");
  }

  remove(...names) {
    const values = this.values();
    names.forEach((name) => values.delete(name));
    this.owner.className = [...values].join(" ");
  }

  contains(name) {
    return this.values().has(name);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.className = "";
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.textContent = "";
    this.parentElement = null;
    this.classList = new FakeClassList(this);
    this.style = {
      setProperty: (name, value) => {
        this.style[name] = value;
      },
    };
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  querySelector(selector) {
    if (selector === "em" || selector === "[data-arm-status]") {
      return this.statusNode || null;
    }
    return null;
  }
}

const elementIds = [
  "chartGrid",
  "chartBars",
  "chartLabels",
  "clock",
  "footerTime",
  "liveDataState",
  "heroPhaseCode",
  "phaseNumber",
  "phaseDial",
  "currentPhaseLabel",
  "cohortRunLabel",
  "pilotRunCount",
  "studyModeLabel",
  "researchTelemetryState",
  "phaseCaptionRight",
  "pipelineChip",
  "liveRunHeading",
  "liveThroughputLabel",
  "liveChartEmptyTitle",
  "liveChartEmptyDetail",
  "liveArm",
  "liveSeed",
  "liveProgress",
  "liveExploitability",
  "livePayoff",
  "liveThroughput",
  "liveProgressFill",
  "liveProgressTrack",
  "liveMetricChart",
  "liveChartGrid",
  "liveChartLine",
  "liveChartPoints",
  "liveChartLabels",
  "liveChartTitle",
  "liveChartDescription",
  "lastSignal",
  "disclosureLiveState",
];

function createHarness() {
  const elements = Object.fromEntries(
    elementIds.map((id) => [id, new FakeElement(id)]),
  );
  const chartShell = new FakeElement("liveChartShell");
  elements.liveMetricChart.parentElement = chartShell;

  const phaseRows = Array.from({ length: 7 }, (_, index) => {
    const row = new FakeElement();
    row.dataset.phase = String(index + 1);
    row.statusNode = new FakeElement();
    return row;
  });
  const armCards = ["terminal", "scaled", "pbrs-cfr-a010", "pbrs-cfr-a025"].map(
    (id) => {
      const card = new FakeElement();
      card.dataset.armId = id;
      card.statusNode = new FakeElement();
      return card;
    },
  );

  const document = {
    hidden: true,
    getElementById: (id) => elements[id] || null,
    createElementNS: (_namespace, name) => new FakeElement(name),
    addEventListener: () => undefined,
    querySelectorAll: (selector) => {
      if (selector === "[data-phase]") return phaseRows;
      if (selector === "[data-arm-id]") return armCards;
      return [];
    },
    querySelector: (selector) => {
      const phaseMatch = selector.match(/^\[data-phase="(\d+)"\]$/);
      if (phaseMatch) {
        return phaseRows.find((row) => row.dataset.phase === phaseMatch[1]) || null;
      }
      const armMatch = selector.match(/^\[data-arm-id="(.+)"\]$/);
      if (armMatch) {
        return armCards.find((card) => card.dataset.armId === armMatch[1]) || null;
      }
      return null;
    },
  };
  const context = vm.createContext({
    document,
    Intl,
    Date,
    Math,
    Number,
    String,
    console,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: async () => {
      throw new Error("fetch should not run in the DOM harness");
    },
  });
  vm.runInContext(appSource, context);
  return { apply: context.applyResearchSignal, elements, chartShell };
}

function exploratoryPayload({
  state,
  runStatus,
  phase = 6,
  completedRuns = 0,
  progress = 0,
  etaSeconds = null,
}) {
  return {
    connectionState: "LIVE",
    capturedAt: "2026-08-03T10:00:00.000Z",
    ageSeconds: 2,
    research: {
      studyId: "leduc-reward-exploratory-scaled-v1",
      cohort: "exploratory",
      protocolMode: "post_outcome_exploratory",
      sourceStudyId: "leduc-reward-study-v1",
      selection: {
        status: "no_candidate_promoted",
        selectedArm: null,
        exploratoryArm: "scaled",
      },
      phase,
      phaseLabel:
        phase === 7
          ? "REPORT EXPLORATORY OUTCOMES"
          : "300K EXPLORATORY EXTENSION",
      state,
      completedRuns,
      totalRuns: 20,
      currentRun: {
        cohort: "exploratory",
        arm: "scaled",
        seed: 31415,
        progress,
        target: 300000,
        fraction: progress / 300000,
        speed: runStatus === "running" ? 41.5 : 0,
        etaSeconds,
        latestExploitability: progress ? 1.12 : null,
        latestPayoff: progress ? 0.21 : null,
        status: runStatus,
      },
      arms: [
        {
          id: "terminal",
          label: "TERMINAL",
          status: completedRuns ? "complete" : "pending",
          completedRuns: Math.floor(completedRuns / 2),
          totalRuns: 10,
          progress: Math.floor(completedRuns / 2) * 300000,
          target: 3000000,
          fraction: Math.floor(completedRuns / 2) / 10,
          latestExploitability: null,
          latestPayoff: null,
        },
        {
          id: "scaled",
          label: "SCALED",
          status: runStatus,
          completedRuns: Math.ceil(completedRuns / 2),
          totalRuns: 10,
          progress: Math.ceil(completedRuns / 2) * 300000 + progress,
          target: 3000000,
          fraction: Math.min(1, (Math.ceil(completedRuns / 2) + progress / 300000) / 10),
          latestExploitability: progress ? 1.12 : null,
          latestPayoff: progress ? 0.21 : null,
        },
      ],
      series: progress
        ? [
            {
              arm: "scaled",
              seed: 31415,
              progress,
              exploitability: 1.12,
              payoff: 0.21,
            },
          ]
        : [],
      milestones: [
        { id: "05", label: "NO CANDIDATE PROMOTED", status: "complete" },
        {
          id: "06",
          label: "300K EXPLORATORY EXTENSION",
          status: phase === 6 ? "active" : "complete",
        },
        {
          id: "07",
          label: "REPORT EXPLORATORY OUTCOMES",
          status: phase === 7 ? "active" : "pending",
        },
      ],
    },
  };
}

test("detail UI renders queued and running exploratory runs truthfully", () => {
  const queued = createHarness();
  queued.apply(
    exploratoryPayload({ state: "queued", runStatus: "pending" }),
  );
  assert.equal(queued.elements.liveDataState.textContent, "QUEUED · AWAITING GPU");
  assert.equal(queued.elements.liveRunHeading.textContent, "下一计划运行 / Next Queued Run");
  assert.equal(queued.elements.liveArm.textContent, "SCALED");
  assert.equal(queued.elements.liveSeed.textContent, "31415");
  assert.equal(queued.elements.liveProgress.textContent, "0 / 300,000");
  assert.equal(queued.elements.pilotRunCount.textContent, "0 / 20 COMPLETE");
  assert.equal(queued.elements.liveThroughput.textContent, "QUEUED · AWAITING GPU");
  assert.ok(queued.elements.liveDataState.classList.contains("queued"));

  const running = createHarness();
  running.apply(
    exploratoryPayload({
      state: "running",
      runStatus: "running",
      progress: 150000,
      etaSeconds: 3600,
    }),
  );
  assert.equal(running.elements.liveDataState.textContent, "EXPLORATORY RUN · LIVE");
  assert.match(running.elements.liveThroughput.textContent, /41\.5 \/S · ETA 1\.0H/);
  assert.ok(running.chartShell.classList.contains("has-data"));
  assert.match(
    running.elements.liveChartDescription.textContent,
    /EXPLORATORY · SINGLE ARM\/SEED/,
  );
});

test("detail UI distinguishes paused, reporting, and completed states", () => {
  const paused = createHarness();
  paused.apply(
    exploratoryPayload({
      state: "idle",
      runStatus: "paused",
      completedRuns: 4,
      progress: 75000,
    }),
  );
  assert.equal(paused.elements.liveDataState.textContent, "PAUSED · CHECKPOINT SAVED");
  assert.equal(paused.elements.liveThroughput.textContent, "PAUSED · CHECKPOINT SAVED");
  assert.ok(paused.elements.liveDataState.classList.contains("paused"));

  const reporting = createHarness();
  reporting.apply(
    exploratoryPayload({
      state: "running",
      runStatus: "complete",
      phase: 7,
      completedRuns: 20,
      progress: 300000,
    }),
  );
  assert.equal(reporting.elements.liveDataState.textContent, "REPORTING · EXPLORATORY");
  assert.equal(reporting.elements.phaseCaptionRight.textContent, "EXPLORATORY REPORT · BUILDING");
  assert.match(reporting.elements.disclosureLiveState.textContent, /20 \/ 20/);

  const complete = createHarness();
  complete.apply(
    exploratoryPayload({
      state: "complete",
      runStatus: "complete",
      phase: 7,
      completedRuns: 20,
      progress: 300000,
    }),
  );
  assert.equal(
    complete.elements.liveDataState.textContent,
    "EXPLORATORY COMPLETE · REPORT SAVED",
  );
  assert.equal(complete.elements.liveRunHeading.textContent, "最近完成运行 / Latest Completed Run");
  assert.equal(complete.elements.liveThroughput.textContent, "COMPLETE · SAVED");
  assert.ok(complete.elements.liveDataState.classList.contains("complete"));
});

test("detail UI surfaces a blocked preflight without claiming the GPU is queued", () => {
  const blocked = createHarness();
  blocked.apply(
    exploratoryPayload({
      state: "blocked",
      runStatus: "pending",
      completedRuns: 0,
      progress: 0,
    }),
  );

  assert.equal(
    blocked.elements.liveDataState.textContent,
    "BLOCKED · PREFLIGHT FAILED",
  );
  assert.equal(
    blocked.elements.liveRunHeading.textContent,
    "启动受阻 / Preflight Blocked",
  );
  assert.equal(
    blocked.elements.liveThroughput.textContent,
    "BLOCKED · NO GPU START",
  );
  assert.match(
    blocked.elements.disclosureLiveState.textContent,
    /预检未通过/,
  );
  assert.ok(blocked.elements.liveDataState.classList.contains("blocked"));
  assert.equal(blocked.elements.liveDataState.classList.contains("queued"), false);
});

test("detail UI never calls a failed Phase 7 report saved", () => {
  const blocked = createHarness();
  blocked.apply(
    exploratoryPayload({
      state: "blocked",
      runStatus: "complete",
      phase: 7,
      completedRuns: 20,
      progress: 300000,
    }),
  );

  assert.equal(
    blocked.elements.liveDataState.textContent,
    "BLOCKED · REPORT FAILED",
  );
  assert.equal(
    blocked.elements.liveRunHeading.textContent,
    "报告受阻 / Report Blocked",
  );
  assert.equal(
    blocked.elements.liveThroughput.textContent,
    "BLOCKED · REPORT NOT SAVED",
  );
  assert.doesNotMatch(blocked.elements.liveDataState.textContent, /SAVED/);
  assert.doesNotMatch(
    blocked.elements.liveThroughput.textContent,
    /REPORT SAVED|COMPLETE · SAVED/,
  );
});

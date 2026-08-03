import assert from "node:assert/strict";
import test from "node:test";

import { createStatusHandler, MAX_BODY_BYTES } from "../lib/rlcard-api.js";
import { decorateStatus, sanitizeStatus } from "../lib/rlcard-status.js";

function validStatus(overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt: "2026-08-01T10:00:00.000Z",
    training: {
      alive: true,
      overallFraction: 0.5,
      completeCount: 5,
      stageCount: 13,
      etaSeconds: 600,
    },
    current: {
      algorithm: "NFSP",
      mode: "self-play",
      seed: 42,
      progress: 270000,
      target: 300000,
      payoff: 0.516,
      ciLow: 0.41,
      ciHigh: 0.62,
      speed: 34.1,
    },
    gpu: {
      utilizationPct: 47,
      memoryUsedMb: 3200,
      memoryTotalMb: 8188,
      temperatureC: 61,
      powerW: 45.1,
    },
    stages: [
      {
        label: "NFSP · seed 42",
        algorithm: "NFSP",
        mode: "self-play",
        seed: 42,
        progress: 270000,
        target: 300000,
        fraction: 0.9,
        status: "running",
      },
    ],
    series: [{ progress: 270000, mean: 0.516, low: 0.41, high: 0.62 }],
    research: {
      studyId: "leduc-reward-study-v1",
      phase: 3,
      phaseLabel: "BUILD REWARD LAYER",
      state: "idle",
      completedRuns: 0,
      totalRuns: 12,
      currentRun: null,
      arms: [
        {
          id: "terminal",
          label: "TERMINAL",
          status: "pending",
          completedRuns: 0,
          totalRuns: 3,
          progress: 0,
          target: 150000,
          fraction: 0,
          latestExploitability: null,
          latestPayoff: null,
          path: "D:\\secret",
        },
      ],
      series: [],
      milestones: [
        { id: "01", label: "FREEZE BASELINE", status: "complete" },
        { id: "03", label: "BUILD REWARD LAYER", status: "active" },
      ],
      pid: 999,
    },
    ...overrides,
  };
}

function responseMock() {
  return {
    headers: {},
    statusCode: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value) {
      this.body = value;
    },
  };
}

function request(method, body, token = "secret") {
  return {
    method,
    body,
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
      "content-length": String(Buffer.byteLength(JSON.stringify(body || {}))),
    },
  };
}

test("sanitizer returns only approved fields", () => {
  const input = validStatus({ pid: 54676, path: "D:\\secret", token: "leak" });
  const result = sanitizeStatus(input);
  assert.equal(result.pid, undefined);
  assert.equal(result.path, undefined);
  assert.equal(result.token, undefined);
  assert.deepEqual(Object.keys(result), [
    "schemaVersion",
    "capturedAt",
    "training",
    "current",
    "gpu",
    "stages",
    "series",
    "research",
  ]);
  assert.equal(result.research.pid, undefined);
  assert.equal(result.research.arms[0].path, undefined);
  assert.deepEqual(Object.keys(result.research), [
    "studyId",
    "phase",
    "phaseLabel",
    "state",
    "completedRuns",
    "totalRuns",
    "currentRun",
    "arms",
    "series",
    "milestones",
  ]);
  assert.deepEqual(Object.keys(result.research.arms[0]), [
    "id",
    "label",
    "status",
    "completedRuns",
    "totalRuns",
    "progress",
    "target",
    "fraction",
    "latestExploitability",
    "latestPayoff",
  ]);
});

test("sanitizer rejects NaN and malformed data", () => {
  const input = validStatus();
  input.current.payoff = Number.NaN;
  assert.throws(() => sanitizeStatus(input), /finite number/);
});

test("research sanitizer strips secrets from every nested collection", () => {
  const input = validStatus();
  input.research.currentRun = {
    cohort: "pilot",
    arm: "terminal",
    seed: 42,
    progress: 1000,
    target: 50000,
    fraction: 0.02,
    speed: 31.5,
    etaSeconds: 1556,
    latestExploitability: 1.2,
    latestPayoff: 0.1,
    status: "running",
    pid: 54676,
    checkpoint: "D:\\private\\checkpoint.pt",
    token: "do-not-return",
  };
  input.research.series = [
    {
      arm: "terminal",
      seed: 42,
      progress: 1000,
      exploitability: 1.2,
      payoff: 0.1,
      localCsv: "D:\\private\\metrics.csv",
    },
  ];
  input.research.milestones[0].stderr = "private log";

  const result = sanitizeStatus(input);
  assert.deepEqual(Object.keys(result.research.currentRun), [
    "cohort",
    "arm",
    "seed",
    "progress",
    "target",
    "fraction",
    "speed",
    "etaSeconds",
    "latestExploitability",
    "latestPayoff",
    "status",
  ]);
  assert.deepEqual(Object.keys(result.research.series[0]), [
    "arm",
    "seed",
    "progress",
    "exploitability",
    "payoff",
  ]);
  assert.deepEqual(Object.keys(result.research.milestones[0]), [
    "id",
    "label",
    "status",
  ]);
  assert.equal(JSON.stringify(result).includes("D:\\private"), false);
  assert.equal(JSON.stringify(result).includes("do-not-return"), false);
  assert.equal(JSON.stringify(result).includes("private log"), false);
});

test("research sanitizer preserves a completed run snapshot and its real series", () => {
  const input = validStatus();
  input.research.phase = 5;
  input.research.phaseLabel = "LOCK ONE CANDIDATE";
  input.research.completedRuns = 12;
  input.research.currentRun = {
    cohort: "pilot",
    arm: "pbrs-cfr-a025",
    seed: 2026,
    progress: 50000,
    target: 50000,
    fraction: 1,
    speed: 51.6,
    etaSeconds: null,
    latestExploitability: 1.2769679026,
    latestPayoff: 0.31125,
    status: "complete",
    checkpoint: "D:\\private\\final.pt",
  };
  input.research.series = [
    {
      arm: "pbrs-cfr-a025",
      seed: 2026,
      progress: 50000,
      exploitability: 1.2769679026,
      payoff: 0.31125,
      localCsv: "D:\\private\\training.csv",
    },
  ];

  const result = sanitizeStatus(input);

  assert.equal(result.research.currentRun.status, "complete");
  assert.equal(result.research.currentRun.arm, "pbrs-cfr-a025");
  assert.equal(result.research.currentRun.seed, 2026);
  assert.equal(result.research.series.length, 1);
  assert.equal(result.research.series[0].exploitability, 1.2769679026);
  assert.equal(JSON.stringify(result).includes("D:\\private"), false);
});

test("research sanitizer rejects impossible progress and non-finite metrics", () => {
  const impossible = validStatus();
  impossible.research.currentRun = {
    cohort: "pilot",
    arm: "terminal",
    seed: 42,
    progress: 50001,
    target: 50000,
    fraction: 1,
    speed: 30,
    etaSeconds: 0,
    latestExploitability: 1,
    latestPayoff: 0.2,
    status: "running",
  };
  assert.throws(() => sanitizeStatus(impossible), /cannot exceed/);

  const nonFinite = validStatus();
  nonFinite.research.arms[0].latestExploitability = Number.POSITIVE_INFINITY;
  assert.throws(() => sanitizeStatus(nonFinite), /finite number/);
});

test("connection state follows freshness thresholds", () => {
  const status = sanitizeStatus(validStatus());
  assert.equal(decorateStatus(status, new Date("2026-08-01T10:00:30Z")).connectionState, "LIVE");
  assert.equal(
    decorateStatus(status, new Date("2026-08-01T10:00:31Z")).connectionState,
    "DELAYED",
  );
  assert.equal(
    decorateStatus(status, new Date("2026-08-01T10:02:01Z")).connectionState,
    "OFFLINE",
  );
});

test("legacy completed payload remains COMPLETE without research telemetry", () => {
  const status = sanitizeStatus(
    validStatus({
      research: undefined,
      training: {
        alive: false,
        overallFraction: 1,
        completeCount: 13,
        stageCount: 13,
        etaSeconds: null,
      },
    }),
  );
  assert.equal(
    decorateStatus(status, new Date("2026-08-01T11:00:00Z")).connectionState,
    "COMPLETE",
  );
});

test("POST requires the ingestion token and stores sanitized data", async () => {
  const stored = new Map();
  const handler = createStatusHandler({
    store: {
      get: (key) => stored.get(key),
      set: (key, value) => stored.set(key, value),
    },
    ingestToken: "secret",
  });

  const unauthorized = responseMock();
  await handler(request("POST", validStatus(), null), unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const accepted = responseMock();
  await handler(request("POST", validStatus({ pid: 123 })), accepted);
  assert.equal(accepted.statusCode, 202);
  assert.equal(stored.values().next().value.pid, undefined);
  assert.equal(stored.values().next().value.research.pid, undefined);
});

test("POST and GET never expose nested research-only private fields", async () => {
  const stored = new Map();
  const handler = createStatusHandler({
    store: {
      get: (key) => stored.get(key),
      set: (key, value) => stored.set(key, value),
    },
    ingestToken: "secret",
    now: () => new Date("2026-08-01T10:00:10Z"),
  });
  const input = validStatus();
  input.research.currentRun = {
    cohort: "pilot",
    arm: "scaled",
    seed: 123,
    progress: 2000,
    target: 50000,
    fraction: 0.04,
    speed: 28.2,
    etaSeconds: 1702,
    latestExploitability: null,
    latestPayoff: 0.12,
    status: "running",
    localPath: "D:\\secret\\run",
    stderr: "hidden",
  };
  input.research.publisherToken = "never-return";

  const accepted = responseMock();
  await handler(request("POST", input), accepted);
  assert.equal(accepted.statusCode, 202);

  const fetched = responseMock();
  await handler(request("GET"), fetched);
  assert.equal(fetched.statusCode, 200);
  const body = JSON.parse(fetched.body);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("D:\\secret"), false);
  assert.equal(serialized.includes("hidden"), false);
  assert.equal(serialized.includes("never-return"), false);
  assert.equal(body.research.currentRun.arm, "scaled");
  assert.equal(body.research.currentRun.progress, 2000);
});

test("GET returns decorated state and handles an empty store", async () => {
  let value;
  const handler = createStatusHandler({
    store: {
      get: () => value,
      set: (_key, next) => {
        value = next;
      },
    },
    ingestToken: "secret",
    now: () => new Date("2026-08-01T10:00:10Z"),
  });

  const empty = responseMock();
  await handler(request("GET"), empty);
  assert.equal(empty.statusCode, 503);

  value = sanitizeStatus(validStatus());
  const populated = responseMock();
  await handler(request("GET"), populated);
  assert.equal(populated.statusCode, 200);
  assert.equal(JSON.parse(populated.body).connectionState, "LIVE");
});

test("oversized payloads are rejected", async () => {
  const handler = createStatusHandler({
    store: { get: () => null, set: () => undefined },
    ingestToken: "secret",
  });
  const response = responseMock();
  const oversized = request("POST", validStatus());
  oversized.headers["content-length"] = String(MAX_BODY_BYTES + 1);
  await handler(oversized, response);
  assert.equal(response.statusCode, 413);
});

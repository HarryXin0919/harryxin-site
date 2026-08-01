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
  ]);
});

test("sanitizer rejects NaN and malformed data", () => {
  const input = validStatus();
  input.current.payoff = Number.NaN;
  assert.throws(() => sanitizeStatus(input), /finite number/);
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

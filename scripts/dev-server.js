import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { createStatusHandler } from "../lib/rlcard-api.js";
import { sanitizeStatus } from "../lib/rlcard-status.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4173);
const fixture = sanitizeStatus({
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  training: {
    alive: true,
    overallFraction: 0.454,
    completeCount: 5,
    stageCount: 13,
    etaSeconds: 900,
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
    memoryUsedMb: 3276,
    memoryTotalMb: 8188,
    temperatureC: 61,
    powerW: 45.1,
  },
  stages: [
    ["DQN · seed 42", "DQN", "random-opponent", 42, 100000, 100000, "complete"],
    ["DQN · seed 123", "DQN", "random-opponent", 123, 100000, 100000, "complete"],
    ["DQN · seed 2026", "DQN", "random-opponent", 2026, 100000, 100000, "complete"],
    ["NFSP 验证 · Random", "NFSP", "random-opponent", 42, 50000, 50000, "complete"],
    ["NFSP 验证 · Self-play", "NFSP", "self-play", 42, 50000, 50000, "complete"],
    ["NFSP · seed 42", "NFSP", "self-play", 42, 270000, 300000, "running"],
    ["NFSP · seed 123", "NFSP", "self-play", 123, 0, 300000, "pending"],
    ["NFSP · seed 2026", "NFSP", "self-play", 2026, 0, 300000, "pending"],
    ["CFR · seed 42", "CFR", "self-play", 42, 0, 20000, "pending"],
    ["CFR · seed 123", "CFR", "self-play", 123, 0, 20000, "pending"],
    ["CFR · seed 2026", "CFR", "self-play", 2026, 0, 20000, "pending"],
    ["统一锦标赛", "EVAL", "round-robin", null, 0, 1, "pending"],
    ["双语实验报告", "REPORT", "report", null, 0, 1, "pending"],
  ].map(([label, algorithm, mode, seed, progress, target, status]) => ({
    label,
    algorithm,
    mode,
    seed,
    progress,
    target,
    fraction: progress / target,
    status,
  })),
  series: Array.from({ length: 27 }, (_, index) => {
    const progress = (index + 1) * 10000;
    const mean = 0.5 + Math.sin(index * 1.4) * 0.07;
    return { progress, mean, low: mean - 0.1, high: mean + 0.1 };
  }),
});
let storedStatus = fixture;
const apiHandler = createStatusHandler({
  store: {
    get: () => storedStatus,
    set: (_key, value) => {
      storedStatus = value;
    },
  },
  ingestToken: process.env.RLCARD_INGEST_TOKEN || "dev-token",
});

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  if (request.url?.startsWith("/api/rlcard/status")) {
    if (request.method === "POST") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      request.body = Buffer.concat(chunks);
    }
    await apiHandler(request, response);
    return;
  }

  const requestPath = decodeURIComponent((request.url || "/").split("?")[0]);
  let filePath = join(root, normalize(requestPath).replace(/^[/\\]+/, ""));
  if (relative(root, filePath).startsWith("..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
    const fileStat = await stat(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Content-Length": fileStat.size,
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Fixture site: http://127.0.0.1:${port}/rlcard/`);
});

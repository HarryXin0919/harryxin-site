import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("homepage research card starts honest and refreshes every three seconds", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  assert.match(homepage, /id="rlcard-research-project"/);
  assert.match(homepage, /id="research-card-state">\s*IDLE · 尚未启动/);
  assert.match(homepage, /id="research-card-phase">— \/ 07/);
  assert.match(homepage, /id="research-card-runs">0 \/ 12/);
  assert.match(homepage, /href="\/rlcard\/research\/"/);
  assert.match(homepage, /setInterval\(load, 3000\)/);
});

test("local development fixture does not invent Phase II research telemetry", async () => {
  const devServer = await readFile(new URL("scripts/dev-server.js", root), "utf8");

  assert.doesNotMatch(devServer, /\bresearch\s*:\s*\{/);
});

test("research detail page defaults to an explicit idle state", async () => {
  const detailPage = await readFile(
    new URL("rlcard/research/index.html", root),
    "utf8",
  );
  const detailApp = await readFile(
    new URL("rlcard/research/app.js", root),
    "utf8",
  );
  const detailStyles = await readFile(
    new URL("rlcard/research/styles.css", root),
    "utf8",
  );

  assert.match(detailPage, /id="currentPhaseLabel">尚未启动 \/ AWAITING DATA/);
  assert.match(detailPage, /id="pilotRunCount">0 \/ 12 PLANNED/);
  assert.match(detailPage, /id="liveProgress">0 \/ 12 RUNS/);
  assert.match(
    detailPage,
    /id="pipelineChip" class="chip idle" data-state="idle">IDLE · NO LIVE PHASE/,
  );
  assert.match(detailApp, /pipelineChip\.dataset\.state = pipelineState/);
  assert.match(detailApp, /document\.addEventListener\("visibilitychange"/);
  assert.match(detailApp, /if \(!document\.hidden\) \{\s*researchRefreshTimer = setInterval/);
  assert.match(detailStyles, /\.chip\.live,\s*\.chip\.running/);
  assert.match(
    detailStyles,
    /\.phase-caption,[\s\S]*\.page-footer \{\s*font-size: 10px;/,
  );
});

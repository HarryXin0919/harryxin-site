import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("homepage research card starts honest and refreshes every three seconds", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  assert.match(homepage, /id="rlcard-research-project"/);
  assert.match(homepage, /id="research-card-state">\s*IDLE · 尚未启动/);
  assert.match(homepage, /id="research-card-phase">— \/ 07/);
  assert.match(homepage, /id="research-card-runs">0 \/ 20/);
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
  assert.match(detailPage, /id="pilotRunCount">0 \/ 20 PLANNED/);
  assert.match(detailPage, /id="liveProgress">0 \/ 20 RUNS/);
  assert.match(detailPage, /id="liveThroughputLabel">THROUGHPUT \/ ETA/);
  assert.match(detailPage, /id="liveChartEmptyTitle">EXPLORATORY SERIES AWAITING START/);
  assert.match(detailPage, /id="liveChartEmptyDetail"/);
  assert.match(
    detailPage,
    /id="pipelineChip" class="chip idle" data-state="idle">IDLE · NO LIVE PHASE/,
  );
  assert.match(detailApp, /pipelineChip\.dataset\.state = pipelineState/);
  assert.match(detailApp, /PILOT COMPLETE · AWAITING SELECTION/);
  assert.match(detailApp, /最近完成运行 \/ Latest Completed Run/);
  assert.match(detailApp, /COMPLETED SNAPSHOT PENDING/);
  assert.match(detailApp, /COMPLETE · SAVED/);
  assert.match(detailApp, /document\.addEventListener\("visibilitychange"/);
  assert.match(detailApp, /if \(!document\.hidden\) \{\s*researchRefreshTimer = setInterval/);
  assert.match(detailStyles, /\.chip\.live,\s*\.chip\.running/);
  assert.match(
    detailStyles,
    /\.phase-caption,[\s\S]*\.page-footer \{\s*font-size: 10px;/,
  );
});

test("frozen endpoint title keeps two intentional Chinese lines", async () => {
  const [detailPage, detailStyles] = await Promise.all([
    readFile(new URL("rlcard/research/index.html", root), "utf8"),
    readFile(new URL("rlcard/research/styles.css", root), "utf8"),
  ]);
  const endpoint = detailPage.match(
    /<aside class="panel endpoint-panel reveal" id="protocol">([\s\S]*?)<\/aside>/,
  );

  assert.ok(endpoint, "frozen endpoint panel is missing");
  assert.match(endpoint[1], /class="panel-heading endpoint-heading"/);
  assert.deepEqual(
    Array.from(
      endpoint[1].matchAll(/class="endpoint-title-line">([^<]+)<\/span>/g),
      (match) => match[1],
    ),
    ["先写规则，", "再看结果。"],
  );
  assert.doesNotMatch(endpoint[1], /<h2>[\s\S]*?<br\s*\/?>/i);
  assert.match(
    detailStyles,
    /\.endpoint-heading\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s,
  );
  assert.match(
    detailStyles,
    /grid-template-areas:\s*"meta status"\s*"title title";/s,
  );
  assert.match(
    detailStyles,
    /\.endpoint-title-line\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;/s,
  );
  assert.match(
    detailStyles,
    /\.endpoint-panel h2\s*\{[^}]*line-height:\s*1(?:\.\d+)?;[^}]*word-break:\s*keep-all;[^}]*line-break:\s*strict;/s,
  );
  assert.match(
    detailStyles,
    /\.formula p\s*\{[^}]*white-space:\s*nowrap;/s,
  );
});

test("homepage distinguishes a completed snapshot from a live run", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  assert.match(homepage, /id="research-card-current-label">CURRENT RUN \/ 当前任务/);
  assert.match(homepage, /id="research-card-speed-label">THROUGHPUT/);
  assert.match(homepage, /id="research-card-eta-label">ETA/);
  assert.match(homepage, /LAST COMPLETED RUN \/ 最近完成/);
  assert.match(homepage, /PILOT COMPLETE · 等待选组/);
  assert.match(
    homepage,
    /researchEtaEl\.textContent = completedSnapshot \? 'SAVED'/,
  );
});

test("homepage presents the extension as post-outcome exploratory", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");

  assert.match(homepage, /POST-OUTCOME EXPLORATORY · NOT CONFIRMATORY/);
  assert.match(homepage, /NO CANDIDATE PROMOTED/);
  assert.match(homepage, /300K EXPLORATORY EXTENSION/);
  assert.match(homepage, /scaled 仅因非 control 方案中 AUC 最低、变换最简单/);
  assert.match(homepage, /rawState === 'queued'/);
  assert.match(homepage, /rawState === 'blocked'/);
  assert.match(homepage, /BLOCKED · PREFLIGHT FAILED/);
  assert.match(homepage, /NO GPU START/);
  assert.match(homepage, /POST-OUTCOME EXPLORATORY/);
  assert.match(homepage, /EXPLORATORY COMPLETION/);
  assert.match(homepage, /LAST COMPLETED RUN \/ 最近完成/);
});

test("homepage inline telemetry renderer remains valid JavaScript", async () => {
  const homepage = await readFile(new URL("index.html", root), "utf8");
  const inlineScripts = Array.from(
    homepage.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1],
  );

  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source) => {
    assert.doesNotThrow(() => new Function(source));
  });
});

test("detail page makes the failed Pilot and exploratory amendment explicit", async () => {
  const detailPage = await readFile(
    new URL("rlcard/research/index.html", root),
    "utf8",
  );
  const detailApp = await readFile(
    new URL("rlcard/research/app.js", root),
    "utf8",
  );

  assert.match(detailPage, /POST-OUTCOME EXPLORATORY · NOT CONFIRMATORY/);
  assert.match(detailPage, /NO CANDIDATE PROMOTED/);
  assert.match(detailPage, /300K EXPLORATORY EXTENSION/);
  assert.match(detailPage, /scaled 仅因非 control 方案中 AUC 最低、变换最简单/);
  assert.doesNotMatch(detailPage, /\b300K CONFIRMATION\b/);
  assert.doesNotMatch(detailPage, /UNSEEN · PAIRED/);

  assert.match(detailApp, /isExploratory/);
  assert.match(detailApp, /POST-OUTCOME EXPLORATORY · NOT CONFIRMATORY/);
  assert.match(detailApp, /QUEUED · AWAITING GPU/);
  assert.match(detailApp, /PAUSED · CHECKPOINT SAVED/);
  assert.match(detailApp, /REPORTING · EXPLORATORY/);
  assert.match(detailApp, /EXPLORATORY · SINGLE ARM\/SEED/);
});

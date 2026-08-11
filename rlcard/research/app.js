(() => {
  "use strict";

  const REPORT_URL = "/rlcard/research/exploratory-report-v1.json";
  const RUN_SNAPSHOT_URL = "/rlcard/research/latest-run-v1.json";
  const STATUS_URL = "/api/rlcard/status";
  const SVG_NS = "http://www.w3.org/2000/svg";

  let reportSummary = null;
  let latestStatus = null;
  let renderedTelemetrySeries = false;

  const byId = (id) => document.getElementById(id);
  const finite = (value) =>
    value !== null && value !== "" && Number.isFinite(Number(value));
  const number = (value) => Number(value);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const formatInteger = (value) =>
    finite(value) ? Math.round(number(value)).toLocaleString("en-US") : "—";

  function assertFinite(value, label) {
    if (!finite(value)) throw new TypeError(`${label} must be finite`);
    return number(value);
  }

  function validateMetric(metric, label, expectedSeeds) {
    if (!metric || metric.differenceDirection !== "scaled_minus_terminal") {
      throw new TypeError(`${label} has the wrong comparison direction`);
    }
    if (!Array.isArray(metric.perSeed) || metric.perSeed.length !== expectedSeeds.length) {
      throw new TypeError(`${label} must contain one row per seed`);
    }

    const seen = new Set();
    metric.perSeed.forEach((row, index) => {
      const seed = assertFinite(row && row.seed, `${label}.perSeed[${index}].seed`);
      if (!Number.isInteger(seed) || seen.has(seed) || !expectedSeeds.includes(seed)) {
        throw new TypeError(`${label} contains an invalid or duplicate seed`);
      }
      seen.add(seed);
      const terminal = assertFinite(row.terminal, `${label}.perSeed[${index}].terminal`);
      const scaled = assertFinite(row.scaled, `${label}.perSeed[${index}].scaled`);
      const difference = assertFinite(row.difference, `${label}.perSeed[${index}].difference`);
      if (Math.abs(scaled - terminal - difference) > 1e-8) {
        throw new TypeError(`${label} contains an inconsistent paired difference`);
      }
    });

    return metric.perSeed;
  }

  function summarizeReport(report) {
    if (!report || report.schemaVersion !== 1) {
      throw new TypeError("Unsupported report schema");
    }
    if (
      report.studyId !== "leduc-reward-exploratory-scaled-v1" ||
      report.analysisType !== "post_outcome_exploratory" ||
      report.confirmatory !== false
    ) {
      throw new TypeError("This page only accepts the frozen exploratory report");
    }
    if (
      !Array.isArray(report.seeds) ||
      report.seeds.length !== 10 ||
      new Set(report.seeds).size !== report.seeds.length ||
      report.seeds.some((seed) => !Number.isInteger(seed))
    ) {
      throw new TypeError("The report must contain ten unique integer seeds");
    }
    if (report.completedRuns !== 20 || report.totalEpisodes !== 6000000) {
      throw new TypeError("The frozen report must contain all twenty runs");
    }

    const finalRows = validateMetric(
      report.metrics && report.metrics.finalExploitability,
      "finalExploitability",
      report.seeds,
    );
    const aucRows = validateMetric(
      report.metrics && report.metrics.exploitabilityAuc,
      "exploitabilityAuc",
      report.seeds,
    );
    const aucWindow = report.metrics.exploitabilityAuc.window;
    if (!Array.isArray(aucWindow) || aucWindow[0] !== 25000 || aucWindow[1] !== 300000) {
      throw new TypeError("The training-path window is not the frozen 25K–300K window");
    }

    const terminalMean = mean(finalRows.map((row) => number(row.terminal)));
    const scaledMean = mean(finalRows.map((row) => number(row.scaled)));
    const terminalMeanAuc = mean(aucRows.map((row) => number(row.terminal)));
    const scaledMeanAuc = mean(aucRows.map((row) => number(row.scaled)));

    return {
      completedRuns: report.completedRuns,
      totalEpisodes: report.totalEpisodes,
      finalRows,
      terminalMean,
      scaledMean,
      finalWorsePercent: ((scaledMean - terminalMean) / terminalMean) * 100,
      terminalBetterPairs: finalRows.filter((row) => row.terminal < row.scaled).length,
      terminalMeanAuc,
      scaledMeanAuc,
      aucWorsePercent: ((scaledMeanAuc - terminalMeanAuc) / terminalMeanAuc) * 100,
      terminalBetterAucPairs: aucRows.filter((row) => row.terminal < row.scaled).length,
    };
  }

  function text(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
  }

  function renderSeedRows(rows) {
    const body = byId("seedRows");
    if (!body || typeof document.createElement !== "function") return;

    const entries = rows.map((row) => {
      const tr = document.createElement("tr");
      const seed = document.createElement("th");
      seed.setAttribute("scope", "row");
      seed.textContent = String(row.seed);

      const terminal = document.createElement("td");
      terminal.textContent = number(row.terminal).toFixed(3);
      const scaled = document.createElement("td");
      scaled.textContent = number(row.scaled).toFixed(3);
      const winner = document.createElement("td");
      winner.textContent = row.terminal <= row.scaled ? "原始奖励" : "奖励 ÷ 7";
      tr.append(seed, terminal, scaled, winner);
      return tr;
    });
    body.replaceChildren(...entries);
  }

  function renderReport(report) {
    const summary = summarizeReport(report);
    reportSummary = summary;

    text("terminalMean", summary.terminalMean.toFixed(3));
    text("scaledMean", summary.scaledMean.toFixed(3));
    text("finalWorsePercent", `${summary.finalWorsePercent.toFixed(1)}%`);
    text("aucWorsePercent", `+${summary.aucWorsePercent.toFixed(1)}%`);

    const chartMax = Math.max(summary.terminalMean, summary.scaledMean);
    const terminalBar = byId("terminalBar");
    const scaledBar = byId("scaledBar");
    if (terminalBar) {
      terminalBar.style.setProperty("--bar-size", `${(summary.terminalMean / chartMax) * 100}%`);
    }
    if (scaledBar) {
      scaledBar.style.setProperty("--bar-size", `${(summary.scaledMean / chartMax) * 100}%`);
    }
    renderSeedRows(summary.finalRows);

    if (latestStatus) renderStatus(latestStatus);
    return summary;
  }

  function statusCopy(data) {
    const research = data && data.research;
    const hasFrozenReport = reportSummary && reportSummary.completedRuns === 20;

    if (hasFrozenReport) {
      const publicRuns = research && finite(research.completedRuns)
        ? `${formatInteger(research.completedRuns)} / ${formatInteger(research.totalRuns)}`
        : "20 / 20";
      const apiBehind = research && number(research.completedRuns) < 20;
      return {
        state: "complete",
        label: "研究完成 · 报告已保存",
        detail: apiBehind
          ? "实时状态快照较旧 · 最终报告为 20 / 20 组"
          : `${publicRuns} 组训练 · 共 6,000,000 局`,
      };
    }

    if (!research) {
      return {
        state: "offline",
        label: "实时状态暂不可用",
        detail: "已保存的研究报告仍可正常阅读",
      };
    }

    const state = String(research.state || "idle").toLowerCase();
    const run = research.currentRun;
    const runState = String((run && run.status) || "").toLowerCase();
    const complete =
      finite(research.totalRuns) &&
      number(research.totalRuns) > 0 &&
      number(research.completedRuns) >= number(research.totalRuns) &&
      state === "complete";
    const displayState = complete
      ? "complete"
      : state === "blocked"
        ? "blocked"
        : runState === "paused"
          ? "paused"
          : state === "queued" || runState === "pending"
            ? "queued"
            : state === "running"
              ? "running"
              : "offline";
    const labels = {
      complete: "研究完成 · 报告已保存",
      running: "研究仍在运行",
      queued: "研究等待开始",
      paused: "研究已暂停 · 恢复点已保存",
      blocked: "研究流程受阻",
      offline: "实时状态暂不可用",
    };

    const runCount = finite(research.completedRuns) && finite(research.totalRuns)
      ? `${formatInteger(research.completedRuns)} / ${formatInteger(research.totalRuns)} 组完成`
      : "等待公开状态";
    const progress = run && finite(run.progress) && finite(run.target)
      ? ` · 当前 ${formatInteger(run.progress)} / ${formatInteger(run.target)}`
      : "";
    return { state: displayState, label: labels[displayState], detail: `${runCount}${progress}` };
  }

  function armLabel(arm) {
    return arm === "terminal" ? "原始奖励" : arm === "scaled" ? "奖励缩小为 1/7" : String(arm || "—");
  }

  function makeSvg(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function showEmptyChart() {
    const chart = byId("runChart");
    const empty = byId("runChartEmpty");
    if (chart) chart.hidden = true;
    if (empty) empty.hidden = false;
  }

  function renderRunSeries(rawPoints, run = {}) {
    const points = (Array.isArray(rawPoints) ? rawPoints : [])
      .filter((point) => finite(point && point.progress) && finite(point && point.exploitability))
      .map((point) => ({
        progress: number(point.progress),
        exploitability: number(point.exploitability),
      }))
      .sort((a, b) => a.progress - b.progress);
    const chart = byId("runChart");
    const grid = byId("runChartGrid");
    const line = byId("runChartLine");
    const pointLayer = byId("runChartPoints");
    const labels = byId("runChartLabels");
    const empty = byId("runChartEmpty");
    if (!chart || !grid || !line || !pointLayer || !labels || points.length < 2) {
      showEmptyChart();
      return false;
    }

    const width = 900;
    const height = 280;
    const margin = { top: 20, right: 22, bottom: 34, left: 62 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xMin = points[0].progress;
    const xMax = points[points.length - 1].progress;
    const values = points.map((point) => point.exploitability);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.14, 0.015);
    const yMin = rawMin - padding;
    const yMax = rawMax + padding;
    const x = (value) => margin.left + ((value - xMin) / Math.max(1, xMax - xMin)) * plotWidth;
    const y = (value) => margin.top + (1 - (value - yMin) / Math.max(0.000001, yMax - yMin)) * plotHeight;

    const gridNodes = [];
    const labelNodes = [];
    for (let index = 0; index < 5; index += 1) {
      const ratio = index / 4;
      const yPosition = margin.top + ratio * plotHeight;
      const value = yMax - ratio * (yMax - yMin);
      gridNodes.push(makeSvg("line", { x1: margin.left, x2: width - margin.right, y1: yPosition, y2: yPosition }));
      const label = makeSvg("text", { x: margin.left - 10, y: yPosition + 4, "text-anchor": "end" });
      label.textContent = value.toFixed(2);
      labelNodes.push(label);
    }
    [points[0], points[points.length - 1]].forEach((point, index) => {
      const label = makeSvg("text", {
        x: x(point.progress),
        y: height - 8,
        "text-anchor": index === 0 ? "start" : "end",
      });
      label.textContent = `${formatInteger(point.progress)} 局`;
      labelNodes.push(label);
    });

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.progress).toFixed(2)},${y(point.exploitability).toFixed(2)}`)
      .join(" ");
    const circles = points.map((point) =>
      makeSvg("circle", {
        cx: x(point.progress).toFixed(2),
        cy: y(point.exploitability).toFixed(2),
        r: 4,
      }),
    );

    grid.replaceChildren(...gridNodes);
    labels.replaceChildren(...labelNodes);
    pointLayer.replaceChildren(...circles);
    line.setAttribute("d", path);
    chart.hidden = false;
    if (empty) empty.hidden = true;

    const title = byId("runChartTitle");
    const description = byId("runChartDescription");
    if (title) title.textContent = `${armLabel(run.arm)}、随机起点 ${run.seed} 的单次真实曲线`;
    if (description) {
      description.textContent = `从 ${formatInteger(xMin)} 到 ${formatInteger(xMax)} 局的策略可利用度；这是单次运行，不是十组平均。`;
    }
    return true;
  }

  function renderRun(run, series) {
    if (!run) return false;
    text("runArm", armLabel(run.arm));
    text("runSeed", finite(run.seed) ? String(number(run.seed)) : "—");
    text("runProgress", `${formatInteger(run.progress)} / ${formatInteger(run.target)}`);
    text(
      "runExploitability",
      finite(run.latestExploitability) ? number(run.latestExploitability).toFixed(3) : "—",
    );
    text("runUpdated", `最后保存的运行：${armLabel(run.arm)} · 随机起点 ${run.seed}。曲线来自这一次运行的真实 CSV，不是跨起点平均。`);
    return renderRunSeries(series, run);
  }

  function renderStatus(data) {
    latestStatus = data;
    const copy = statusCopy(data);
    const status = byId("studyStatus");
    if (status) status.dataset.state = copy.state;
    text("studyStatusLabel", copy.label);
    text("studyStatusDetail", copy.detail);

    const research = data && data.research;
    const run = research && research.currentRun;
    const isSavedRun = run && String(run.status || "").toLowerCase() === "complete";
    if (isSavedRun && renderRun(run, research.series)) {
      renderedTelemetrySeries = true;
    }
    return copy;
  }

  function validateRunSnapshot(snapshot) {
    if (
      !snapshot ||
      snapshot.schemaVersion !== 1 ||
      snapshot.arm !== "terminal" ||
      snapshot.seed !== 23003 ||
      snapshot.target !== 300000 ||
      !Array.isArray(snapshot.series)
    ) {
      throw new TypeError("Invalid frozen run snapshot");
    }
    snapshot.series.forEach((point, index) => {
      assertFinite(point.progress, `series[${index}].progress`);
      assertFinite(point.exploitability, `series[${index}].exploitability`);
    });
    return snapshot;
  }

  function renderRunSnapshot(snapshot) {
    const valid = validateRunSnapshot(snapshot);
    if (renderedTelemetrySeries) return false;
    const finalPoint = valid.series[valid.series.length - 1];
    const run = {
      arm: valid.arm,
      seed: valid.seed,
      progress: valid.target,
      target: valid.target,
      latestExploitability: finalPoint.exploitability,
      status: "complete",
    };
    renderRun(run, valid.series);
    return true;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  }

  async function boot() {
    const reportPromise = fetchJson(REPORT_URL, {
      headers: { Accept: "application/json" },
      cache: "force-cache",
    })
      .then(renderReport)
      .catch(() => null);

    const statusPromise = fetchJson(STATUS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(renderStatus)
      .catch(() => renderStatus(null));

    const runPromise = fetchJson(RUN_SNAPSHOT_URL, {
      headers: { Accept: "application/json" },
      cache: "force-cache",
    })
      .then(renderRunSnapshot)
      .catch(() => {
        if (!renderedTelemetrySeries) showEmptyChart();
        return null;
      });

    await Promise.all([reportPromise, statusPromise, runPromise]);
  }

  globalThis.RLCardPublicReport = Object.freeze({
    summarizeReport,
    renderReport,
    statusCopy,
    renderStatus,
    renderRunSeries,
    validateRunSnapshot,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

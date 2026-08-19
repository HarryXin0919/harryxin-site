(() => {
  "use strict";

  const EXPLORATORY_REPORT_URL = "/rlcard/research/exploratory-report-v1.json";
  const MECHANISM_REPORT_URL = "/rlcard/research/mechanism-report-v1.json";
  const RUN_SNAPSHOT_URL = "/rlcard/research/latest-run-v1.json";
  const STATUS_URL = "/api/rlcard/status";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MECHANISM_ARMS = [
    "terminal",
    "scaled",
    "scaled-pbrs-cfr-a025",
    "unscaled-pbrs-cfr-a175",
  ];
  const MECHANISM_SEEDS = [47982, 81425, 45579, 34975, 86195, 68642, 31659, 54386];
  const MECHANISM_PUBLIC_REPORT_FIELDS = new Set([
    "schemaVersion", "studyId", "sourceStudyId", "analysisType", "confirmatory",
    "generatedAt", "arms", "seeds", "completedRuns", "totalEpisodes",
    "primaryEndpoint", "metrics", "promotion", "claimLimit",
  ]);
  const PRIVATE_REPORT_KEY = /(path|checkpoint|provenance|revision|sha256|hash|stderr|stdout|(?:^|_)(?:pid|log|logs)(?:$|_))/i;

  let reportSummary = null;
  let mechanismReportSummary = null;
  let latestStatus = null;
  let renderedTelemetrySeries = false;
  let statusTimer = null;
  let reportTimer = null;

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

  function assertPublicReportTree(value, label, seen = new Set()) {
    if (value === null && label === "promotion.selectedArm") return seen;
    if (value === null || value === undefined) {
      throw new TypeError(`${label} cannot contain null values`);
    }
    if (typeof value === "number") {
      assertFinite(value, label);
      seen.add("number");
      return seen;
    }
    if (["string", "boolean"].includes(typeof value)) return seen;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => assertPublicReportTree(entry, `${label}[${index}]`, seen));
      return seen;
    }
    if (typeof value !== "object") throw new TypeError(`${label} has an unsupported value`);
    Object.entries(value).forEach(([key, entry]) => {
      if (PRIVATE_REPORT_KEY.test(key)) {
        throw new TypeError(`${label} contains a private field`);
      }
      assertPublicReportTree(entry, `${label}.${key}`, seen);
    });
    return seen;
  }

  function text(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
  }

  function hidden(id, value) {
    const element = byId(id);
    if (element) element.hidden = Boolean(value);
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

  function summarizeMechanismReport(report) {
    if (!report || report.schemaVersion !== 1) {
      throw new TypeError("Unsupported mechanism report schema");
    }
    if (
      report.studyId !== "leduc-reward-mechanism-scale-pbrs-v1" ||
      report.sourceStudyId !== "leduc-reward-exploratory-scaled-v1" ||
      report.analysisType !== "post_outcome_mechanism_screening" ||
      report.confirmatory !== false
    ) {
      throw new TypeError("This page only accepts the frozen non-confirmatory mechanism report");
    }
    const unexpected = Object.keys(report).filter(
      (field) => !MECHANISM_PUBLIC_REPORT_FIELDS.has(field),
    );
    if (unexpected.length) {
      throw new TypeError("The mechanism report contains non-public fields");
    }
    if (
      !Array.isArray(report.arms) ||
      report.arms.length !== MECHANISM_ARMS.length ||
      MECHANISM_ARMS.some((arm) => !report.arms.includes(arm))
    ) {
      throw new TypeError("The mechanism report must contain the four frozen arms");
    }
    if (
      !Array.isArray(report.seeds) ||
      report.seeds.length !== MECHANISM_SEEDS.length ||
      new Set(report.seeds).size !== report.seeds.length ||
      report.seeds.some((seed) => !Number.isInteger(seed)) ||
      MECHANISM_SEEDS.some((seed) => !report.seeds.includes(seed))
    ) {
      throw new TypeError("The mechanism report must contain eight unique integer seeds");
    }
    if (report.completedRuns !== 32 || report.totalEpisodes !== 3200000) {
      throw new TypeError("The mechanism report must contain all thirty-two runs");
    }
    const promotion = report.promotion;
    if (!promotion || !["candidate_advanced", "no_candidate_advanced"].includes(promotion.status)) {
      throw new TypeError("The mechanism report has an invalid promotion decision");
    }
    if (
      promotion.status === "candidate_advanced" &&
      !["scaled-pbrs-cfr-a025", "unscaled-pbrs-cfr-a175"].includes(promotion.selectedArm)
    ) {
      throw new TypeError("An advanced candidate must name one frozen PBRS arm");
    }
    if (promotion.status === "no_candidate_advanced" && promotion.selectedArm !== null) {
      throw new TypeError("A no-advance decision cannot name a selected arm");
    }
    if (promotion.automaticConfirmationAuthorized !== false) {
      throw new TypeError("The mechanism report cannot authorize automatic confirmation");
    }
    const numericMetrics = assertPublicReportTree(report.metrics, "metrics");
    if (!numericMetrics.has("number")) {
      throw new TypeError("The mechanism report must contain finite public metrics");
    }
    assertPublicReportTree(report.primaryEndpoint, "primaryEndpoint");
    assertPublicReportTree(promotion, "promotion");
    if (typeof report.claimLimit !== "string" || !report.claimLimit.trim()) {
      throw new TypeError("The mechanism report must state its claim limit");
    }
    return {
      completedRuns: report.completedRuns,
      totalEpisodes: report.totalEpisodes,
      status: promotion.status,
      selectedArm: promotion.selectedArm,
      claimLimit: typeof report.claimLimit === "string" ? report.claimLimit : "",
    };
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

  function isMechanismResearch(research) {
    return Boolean(
      research &&
      (research.cohort === "mechanism" ||
        research.protocolMode === "post_outcome_mechanism_screening"),
    );
  }

  function mechanismDisplayState(research) {
    const state = String((research && research.state) || "idle").toLowerCase();
    const runState = String((research && research.currentRun && research.currentRun.status) || "").toLowerCase();
    if (state === "complete") return "complete";
    if (state === "blocked") return "blocked";
    if (state === "reporting" || (research && research.phase === 9 && state === "running")) {
      return "reporting";
    }
    if (state === "paused" || runState === "paused") return "paused";
    if (state === "queued" || runState === "pending") return "queued";
    if (state === "running") return "running";
    return "offline";
  }

  function statusCopy(data) {
    const research = data && data.research;
    const mechanism = isMechanismResearch(research) || Boolean(mechanismReportSummary);
    if (mechanismReportSummary && mechanism) {
      return {
        state: "complete",
        label: "机制筛查完成 · 报告已保存",
        detail: "32 / 32 组训练 · 共 3,200,000 局",
      };
    }
    if (isMechanismResearch(research)) {
      const displayState = mechanismDisplayState(research);
      const connection = String((data && data.connectionState) || "OFFLINE").toUpperCase();
      const labels = {
        complete: "训练完成 · 等待冻结报告",
        running: "机制筛查正在训练",
        queued: "机制筛查等待开始",
        paused: "训练已暂停 · 恢复点已保存",
        reporting: "训练完成 · 正在整理报告",
        blocked: research.phase === 9 ? "报告生成受阻" : "机制筛查启动受阻",
        offline: "机制筛查状态暂不可用",
      };
      const runCount = finite(research.completedRuns) && finite(research.totalRuns)
        ? `${formatInteger(research.completedRuns)} / ${formatInteger(research.totalRuns)} 组完成`
        : "等待公开状态";
      const run = research.currentRun;
      const progress = run && finite(run.progress) && finite(run.target)
        ? ` · 当前 ${formatInteger(run.progress)} / ${formatInteger(run.target)}`
        : "";
      if (connection === "OFFLINE" || connection === "DELAYED") {
        return {
          state: "offline",
          label: connection === "DELAYED" ? "实时更新出现延迟" : "实时更新暂时中断",
          detail: `保留最后一次公开快照 · ${runCount}${progress}`,
        };
      }
      return { state: displayState, label: labels[displayState], detail: `${runCount}${progress}` };
    }

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
    const labels = {
      terminal: "原始奖励",
      scaled: "奖励缩小为 1/7",
      "scaled-pbrs-cfr-a025": "缩小奖励 + CFR 引导",
      "unscaled-pbrs-cfr-a175": "原始尺度 + CFR 引导",
    };
    return labels[arm] || String(arm || "—");
  }

  function makeSvg(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function showEmptyChart(ids, message) {
    const chart = byId(ids.chart);
    const empty = byId(ids.empty);
    if (chart) chart.hidden = true;
    if (empty) {
      empty.hidden = false;
      if (message) empty.textContent = message;
    }
  }

  function renderSeriesInto(rawPoints, run, ids) {
    const points = (Array.isArray(rawPoints) ? rawPoints : [])
      .filter((point) => finite(point && point.progress) && finite(point && point.exploitability))
      .map((point) => ({ progress: number(point.progress), exploitability: number(point.exploitability) }))
      .sort((a, b) => a.progress - b.progress);
    const chart = byId(ids.chart);
    const grid = byId(ids.grid);
    const line = byId(ids.line);
    const pointLayer = byId(ids.points);
    const labels = byId(ids.labels);
    const empty = byId(ids.empty);
    if (!chart || !grid || !line || !pointLayer || !labels || points.length < 1) {
      showEmptyChart(ids, ids.emptyMessage);
      return false;
    }

    const width = 900;
    const height = 280;
    const margin = { top: 20, right: 22, bottom: 34, left: 62 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xMin = points.length === 1 ? 0 : points[0].progress;
    const xMax = points.length === 1
      ? Math.max(points[0].progress, finite(run.target) ? number(run.target) : points[0].progress)
      : points[points.length - 1].progress;
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
    [{ progress: xMin, anchor: "start" }, { progress: xMax, anchor: "end" }].forEach((point) => {
      const label = makeSvg("text", { x: x(point.progress), y: height - 8, "text-anchor": point.anchor });
      label.textContent = `${formatInteger(point.progress)} 局`;
      labelNodes.push(label);
    });
    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.progress).toFixed(2)},${y(point.exploitability).toFixed(2)}`)
      .join(" ");
    const circles = points.map((point) =>
      makeSvg("circle", { cx: x(point.progress).toFixed(2), cy: y(point.exploitability).toFixed(2), r: 4 }),
    );
    grid.replaceChildren(...gridNodes);
    labels.replaceChildren(...labelNodes);
    pointLayer.replaceChildren(...circles);
    line.setAttribute("d", path);
    chart.hidden = false;
    if (empty) empty.hidden = true;

    const title = byId(ids.title);
    const description = byId(ids.description);
    if (title) title.textContent = `${armLabel(run.arm)}、随机起点 ${run.seed} 的单次真实曲线`;
    if (description) {
      description.textContent = `从 ${formatInteger(points[0].progress)} 到 ${formatInteger(points[points.length - 1].progress)} 局的策略可利用度；这是单次运行，不是跨随机起点平均。`;
    }
    return true;
  }

  const archiveChartIds = {
    chart: "runChart", grid: "runChartGrid", line: "runChartLine", points: "runChartPoints",
    labels: "runChartLabels", empty: "runChartEmpty", title: "runChartTitle",
    description: "runChartDescription",
    emptyMessage: "曲线暂时无法读取；上面的研究总结仍来自已保存的完整报告。",
  };
  const mechanismChartIds = {
    chart: "mechanismRunChart", grid: "mechanismRunChartGrid", line: "mechanismRunChartLine",
    points: "mechanismRunChartPoints", labels: "mechanismRunChartLabels",
    empty: "mechanismRunChartEmpty", title: "mechanismRunChartTitle",
    description: "mechanismRunChartDescription",
    emptyMessage: "首个真实指标点会在 10,000 局后出现。",
  };

  function renderRunSeries(rawPoints, run = {}) {
    return renderSeriesInto(rawPoints, run, archiveChartIds);
  }

  function renderRun(run, series) {
    if (!run) return false;
    text("runArm", armLabel(run.arm));
    text("runSeed", finite(run.seed) ? String(number(run.seed)) : "—");
    text("runProgress", `${formatInteger(run.progress)} / ${formatInteger(run.target)}`);
    text("runExploitability", finite(run.latestExploitability) ? number(run.latestExploitability).toFixed(3) : "—");
    text("runUpdated", `最后保存的运行：${armLabel(run.arm)} · 随机起点 ${run.seed}。曲线来自这一次运行的真实 CSV，不是跨起点平均。`);
    return renderRunSeries(series, run);
  }

  function activateMechanismView(active) {
    hidden("mechanismView", !active);
    hidden("exploratoryArchive", active);
    if (document.body && document.body.dataset) {
      document.body.dataset.researchView = active ? "mechanism" : "exploratory";
    }
    if (active) {
      text("heroKicker", "RLCard · LEDUC HOLD'EM · MECHANISM SCREEN");
      text("heroBoundary", "看过前期结果后进行的机制筛查 · 不是确认性实验");
      text("page-title", "奖励变差，是公式的问题，还是因为整体变小了？");
      text("pageLede", "我们把“奖励大小”和“CFR 引导”拆开测试。四种设置使用相同的随机起点，先查清原因，再决定是否值得做正式验证。");
      text("footerStudy", "RLCard Reward Mechanism Study · 2026");
      text("footerData", "计划：32 次运行 · 3,200,000 局");
      const navSummary = byId("navSummary");
      const navComparison = byId("navComparison");
      const navEvidence = byId("navEvidence");
      if (navSummary) {
        navSummary.setAttribute("href", "#mechanism-question");
        navSummary.textContent = "研究问题";
      }
      if (navComparison) {
        navComparison.setAttribute("href", "#mechanism-live");
        navComparison.textContent = "实时进度";
      }
      if (navEvidence) {
        navEvidence.setAttribute("href", "#mechanism-expert");
        navEvidence.textContent = "方法与边界";
      }
      if (document.title !== undefined) {
        document.title = "奖励变差，究竟是哪一步造成的？ · RLCard 机制筛查";
      }
      const pageDescription = byId("pageDescription");
      const openGraphTitle = byId("openGraphTitle");
      const openGraphDescription = byId("openGraphDescription");
      if (pageDescription) {
        pageDescription.setAttribute("content", "一项面向普通读者公开过程的 RLCard 机制筛查：分别测试奖励大小和 CFR 引导。本研究不是确认性实验。");
      }
      if (openGraphTitle) {
        openGraphTitle.setAttribute("content", "奖励变差，究竟是哪一步造成的？ · Harry Xin");
      }
      if (openGraphDescription) {
        openGraphDescription.setAttribute("content", "4 种设置、8 个随机起点、32 次训练：实时查看奖励尺度与 CFR 引导的机制筛查。");
      }
    }
  }

  function armProgress(research, armId) {
    const arm = Array.isArray(research.arms)
      ? research.arms.find((entry) => entry && entry.id === armId)
      : null;
    return arm && finite(arm.completedRuns) && finite(arm.totalRuns)
      ? `${formatInteger(arm.completedRuns)} / ${formatInteger(arm.totalRuns)}`
      : "0 / 8";
  }

  function formatDuration(seconds) {
    if (!finite(seconds)) return "—";
    const value = Math.max(0, number(seconds));
    if (value < 60) return `${Math.ceil(value)} 秒`;
    if (value < 3600) return `${Math.ceil(value / 60)} 分钟`;
    return `${(value / 3600).toFixed(1)} 小时`;
  }

  function csvRowsForRun(rawPoints, run = {}) {
    if (!run || !Array.isArray(rawPoints)) return [];
    return rawPoints
      .filter((point) => point && point.arm === run.arm && number(point.seed) === number(run.seed))
      .filter((point) => finite(point.progress) && (finite(point.exploitability) || finite(point.payoff)))
      .map((point) => ({
        arm: point.arm,
        seed: number(point.seed),
        progress: number(point.progress),
        exploitability: finite(point.exploitability) ? number(point.exploitability) : null,
        payoff: finite(point.payoff) ? number(point.payoff) : null,
      }))
      .sort((a, b) => a.progress - b.progress);
  }

  function csvMetric(value, { signed = false } = {}) {
    if (!finite(value)) return "—";
    const numeric = number(value);
    const prefix = signed && numeric > 0 ? "+" : "";
    return `${prefix}${numeric.toFixed(6)}`;
  }

  function renderMechanismCsv(run, series, displayState) {
    const body = byId("mechanismCsvBody");
    const rows = csvRowsForRun(series, run || {});
    text("mechanismCsvCount", `${rows.length} ${rows.length === 1 ? "ROW" : "ROWS"}`);
    if (!body || typeof document.createElement !== "function") return rows;

    if (!rows.length) {
      const row = document.createElement("tr");
      row.className = "mechanism-csv-empty";
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = displayState === "queued"
        ? "训练尚未开始；首个数据点将在 10,000 局后出现。"
        : displayState === "paused"
          ? "当前运行还没有已保存的数据行；恢复后会自动更新。"
          : displayState === "blocked"
            ? "研究流程受阻；排除问题前不会产生新的公开数据行。"
            : "当前没有可公开的单次运行数据行。";
      row.appendChild(cell);
      body.replaceChildren(row);
      return rows;
    }

    const nodes = rows.map((point, index) => {
      const row = document.createElement("tr");
      if (index === rows.length - 1) row.dataset.latest = "true";
      const values = [
        armLabel(point.arm),
        String(point.seed),
        formatInteger(point.progress),
        csvMetric(point.exploitability),
        csvMetric(point.payoff, { signed: true }),
      ];
      values.forEach((value, cellIndex) => {
        const cell = document.createElement(cellIndex === 0 ? "th" : "td");
        if (cellIndex === 0) cell.scope = "row";
        cell.textContent = value;
        row.appendChild(cell);
      });
      return row;
    });
    body.replaceChildren(...nodes);
    return rows;
  }

  function renderMechanismRun(run, series, displayState) {
    text("mechanismRunArm", run ? armLabel(run.arm) : "等待下一次运行");
    text("mechanismRunSeed", run && finite(run.seed) ? String(number(run.seed)) : "—");
    text("mechanismRunProgress", run ? `${formatInteger(run.progress)} / ${formatInteger(run.target)}` : "—");
    text("mechanismRunExploitability", run && finite(run.latestExploitability) ? number(run.latestExploitability).toFixed(3) : "—");
    text("mechanismRunPayoff", run && finite(run.latestPayoff) ? number(run.latestPayoff).toFixed(3) : "—");
    text("mechanismRunSpeed", run && finite(run.speed) && number(run.speed) > 0 ? `${number(run.speed).toFixed(1)} 局/秒` : "—");
    text(
      "mechanismRunEta",
      run && finite(run.etaSeconds) && displayState === "running"
        ? formatDuration(run.etaSeconds)
        : displayState === "queued"
          ? "等待 GPU"
          : displayState === "paused"
            ? "等待恢复"
            : "—",
    );
    const chartPoints = Array.isArray(series) && run
      ? series.filter((point) => point.arm === run.arm && number(point.seed) === number(run.seed))
      : [];
    const emptyCopy = displayState === "queued"
      ? "训练尚未开始。启动后，10,000 局处会出现第一个真实指标点。"
      : displayState === "paused"
        ? "这次运行还没有保存可绘制的指标点；恢复后会继续更新。"
        : displayState === "reporting" || displayState === "complete"
          ? "当前没有单次曲线；最终结论只会来自冻结的 32 组汇总报告。"
          : displayState === "blocked"
            ? "研究流程已受阻；排除问题前不会生成新的指标点。"
          : mechanismChartIds.emptyMessage;
    const ids = { ...mechanismChartIds, emptyMessage: emptyCopy };
    renderMechanismCsv(run, series, displayState);
    return run ? renderSeriesInto(chartPoints, run, ids) : (showEmptyChart(ids, emptyCopy), false);
  }

  function renderMechanismStatus(research) {
    const displayState = mechanismDisplayState(research);
    const completed = finite(research.completedRuns) ? number(research.completedRuns) : 0;
    const total = finite(research.totalRuns) ? number(research.totalRuns) : 32;
    const run = research.currentRun;
    const runState = String((run && run.status) || "").toLowerCase();
    const activeFraction = run && ["running", "paused"].includes(runState) && finite(run.fraction)
      ? Math.max(0, Math.min(1, number(run.fraction)))
      : 0;
    const overallFraction = Math.max(0, Math.min(1, (completed + activeFraction) / Math.max(1, total)));
    text("mechanismPhase", `PHASE ${String(research.phase || 8).padStart(2, "0")} / 09`);
    text("mechanismRuns", `${formatInteger(completed)} / ${formatInteger(total)}`);
    text("mechanismProgressText", `${formatInteger(completed)} / ${formatInteger(total)} 组完成`);
    text("mechanismArmTerminal", armProgress(research, "terminal"));
    text("mechanismArmScaled", armProgress(research, "scaled"));
    text("mechanismArmScaledPbrs", armProgress(research, "scaled-pbrs-cfr-a025"));
    text("mechanismArmUnscaledPbrs", armProgress(research, "unscaled-pbrs-cfr-a175"));
    const bar = byId("mechanismProgressBar");
    if (bar) bar.style.width = `${(overallFraction * 100).toFixed(2)}%`;
    const shell = byId("mechanismProgressShell");
    if (shell) shell.dataset.state = displayState;
    renderMechanismRun(run, research.series, displayState);
  }

  function renderStatus(data) {
    latestStatus = data;
    const research = data && data.research;
    const mechanism = isMechanismResearch(research) || Boolean(mechanismReportSummary);
    activateMechanismView(mechanism);
    const copy = statusCopy(data);
    const status = byId("studyStatus");
    if (status) status.dataset.state = copy.state;
    text("studyStatusLabel", copy.label);
    text("studyStatusDetail", copy.detail);
    if (isMechanismResearch(research)) {
      renderMechanismStatus(research);
      return copy;
    }
    const run = research && research.currentRun;
    const isSavedRun = run && String(run.status || "").toLowerCase() === "complete";
    if (isSavedRun && renderRun(run, research.series)) renderedTelemetrySeries = true;
    return copy;
  }

  function renderMechanismReport(report) {
    const summary = summarizeMechanismReport(report);
    mechanismReportSummary = summary;
    if (reportTimer !== null && typeof globalThis.clearTimeout === "function") {
      globalThis.clearTimeout(reportTimer);
      reportTimer = null;
    }
    activateMechanismView(true);
    hidden("mechanismReport", false);
    const advanced = summary.status === "candidate_advanced";
    text("mechanismReportTitle", advanced ? "有一个方案达到预先门槛，但还没有被正式确认。" : "没有方案达到预先门槛。");
    text("mechanismReportDecision", advanced ? armLabel(summary.selectedArm) : "没有方案晋级");
    text(
      "mechanismReportPlain",
      advanced
        ? "它只获得了进入下一项独立验证的资格，不能写成已经有效。"
        : "这条奖励塑形路线到此停止，不会用同一批数据继续调参数。",
    );
    text("mechanismPhase", "PHASE 09 / 09");
    text("mechanismRuns", "32 / 32");
    text("mechanismProgressText", "32 / 32 组完成");
    text("mechanismArmTerminal", "8 / 8");
    text("mechanismArmScaled", "8 / 8");
    text("mechanismArmScaledPbrs", "8 / 8");
    text("mechanismArmUnscaledPbrs", "8 / 8");
    const bar = byId("mechanismProgressBar");
    if (bar) bar.style.width = "100%";
    const shell = byId("mechanismProgressShell");
    if (shell) shell.dataset.state = "complete";
    if (latestStatus) renderStatus(latestStatus);
    else renderStatus(null);
    return summary;
  }

  function validateRunSnapshot(snapshot) {
    if (
      !snapshot || snapshot.schemaVersion !== 1 || snapshot.arm !== "terminal" ||
      snapshot.seed !== 23003 || snapshot.target !== 300000 || !Array.isArray(snapshot.series)
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
      arm: valid.arm, seed: valid.seed, progress: valid.target, target: valid.target,
      latestExploitability: finalPoint.exploitability, status: "complete",
    };
    renderRun(run, valid.series);
    return true;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  }

  async function loadStatus() {
    try {
      const data = await fetchJson(STATUS_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
      renderStatus(data);
      return data;
    } catch (error) {
      if (!latestStatus) {
        renderStatus(null);
      } else {
        const status = byId("studyStatus");
        if (status) status.dataset.state = "offline";
        text("studyStatusLabel", "实时更新暂时中断");
        text("studyStatusDetail", "保留最后一次成功读取的曲线，连接恢复后会自动更新");
      }
      return null;
    }
  }

  function shouldPollMechanismReport(research) {
    const state = String((research && research.state) || "").toLowerCase();
    return !mechanismReportSummary && isMechanismResearch(research) &&
      ["reporting", "complete"].includes(state);
  }

  async function loadMechanismReport() {
    try {
      const report = await fetchJson(MECHANISM_REPORT_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      renderMechanismReport(report);
      return report;
    } catch {
      return null;
    }
  }

  function scheduleMechanismReportRefresh() {
    const research = latestStatus && latestStatus.research;
    if (
      reportTimer !== null ||
      typeof globalThis.setTimeout !== "function" ||
      !shouldPollMechanismReport(research)
    ) return;
    reportTimer = globalThis.setTimeout(async () => {
      reportTimer = null;
      await loadMechanismReport();
      scheduleMechanismReportRefresh();
    }, 15000);
  }

  function scheduleStatusRefresh() {
    if (statusTimer !== null || typeof globalThis.setTimeout !== "function") return;
    const research = latestStatus && latestStatus.research;
    if (mechanismReportSummary) return;
    if (isMechanismResearch(research) && String(research.state || "") === "complete") {
      scheduleMechanismReportRefresh();
      return;
    }
    statusTimer = globalThis.setTimeout(async () => {
      statusTimer = null;
      await loadStatus();
      scheduleMechanismReportRefresh();
      scheduleStatusRefresh();
    }, 3000);
  }

  async function boot() {
    const reportPromise = fetchJson(EXPLORATORY_REPORT_URL, { headers: { Accept: "application/json" }, cache: "force-cache" })
      .then(renderReport)
      .catch(() => null);
    const mechanismReportPromise = loadMechanismReport();
    const statusPromise = loadStatus().then((result) => {
      scheduleStatusRefresh();
      return result;
    });
    const runPromise = fetchJson(RUN_SNAPSHOT_URL, { headers: { Accept: "application/json" }, cache: "force-cache" })
      .then(renderRunSnapshot)
      .catch(() => {
        if (!renderedTelemetrySeries) showEmptyChart(archiveChartIds);
        return null;
      });
    await Promise.all([reportPromise, mechanismReportPromise, statusPromise, runPromise]);
  }

  globalThis.RLCardPublicReport = Object.freeze({
    summarizeReport,
    summarizeMechanismReport,
    renderReport,
    renderMechanismReport,
    statusCopy,
    renderStatus,
    renderRunSeries,
    csvRowsForRun,
    validateRunSnapshot,
    shouldPollMechanismReport,
    loadMechanismReport,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

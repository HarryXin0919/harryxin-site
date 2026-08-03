const byId = (id) => document.getElementById(id);

const shanghaiClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const baselinePolicies = [
  { label: "RANDOM", detail: "CONTROL", value: 1.4716049383, kind: "random" },
  { label: "NFSP · 42", detail: "300K FINAL", value: 1.165778019, kind: "nfsp" },
  { label: "NFSP · 123", detail: "300K FINAL", value: 1.1660827372, kind: "nfsp" },
  { label: "NFSP · 2026", detail: "300K FINAL", value: 1.1887644074, kind: "nfsp" },
  { label: "CFR", detail: "20K FINAL", value: 0.2950468803, kind: "cfr" },
];

const armLabels = {
  terminal: "TERMINAL",
  scaled: "SCALED",
  "pbrs-cfr-a010": "PBRS · LOW",
  "pbrs-cfr-a025": "PBRS · MID",
};

function svgNode(name, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function renderExploitabilityChart() {
  const grid = byId("chartGrid");
  const bars = byId("chartBars");
  const labels = byId("chartLabels");
  grid.replaceChildren();
  bars.replaceChildren();
  labels.replaceChildren();

  const width = 820;
  const left = 156;
  const right = 62;
  const top = 34;
  const rowHeight = 52;
  const barHeight = 11;
  const plotWidth = width - left - right;
  const maxValue = 1.6;
  const x = (value) => left + (value / maxValue) * plotWidth;

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (tick / 4) * maxValue;
    const position = x(value);
    grid.append(
      svgNode("line", {
        x1: position,
        x2: position,
        y1: 17,
        y2: 297,
        class: "chart-grid-line",
      }),
    );
    const tickLabel = svgNode("text", {
      x: position,
      y: 318,
      "text-anchor": tick === 0 ? "start" : tick === 4 ? "end" : "middle",
      class: "chart-axis-label",
    });
    tickLabel.textContent = value.toFixed(1);
    labels.append(tickLabel);
  }

  baselinePolicies.forEach((policy, index) => {
    const y = top + index * rowHeight;
    const policyLabel = svgNode("text", {
      x: 0,
      y: y + 4,
      class: "chart-policy-label",
    });
    policyLabel.textContent = policy.label;
    labels.append(policyLabel);

    const policyDetail = svgNode("text", {
      x: 0,
      y: y + 18,
      class: "chart-axis-label",
    });
    policyDetail.textContent = policy.detail;
    labels.append(policyDetail);

    bars.append(
      svgNode("rect", {
        x: left,
        y: y - barHeight / 2,
        width: plotWidth,
        height: barHeight,
        class: "chart-bar-track",
      }),
    );

    bars.append(
      svgNode("rect", {
        x: left,
        y: y - barHeight / 2,
        width: Math.max(2, x(policy.value) - left),
        height: barHeight,
        class: `chart-bar ${policy.kind}`,
        style: `animation-delay:${120 + index * 90}ms`,
      }),
    );

    const valueLabel = svgNode("text", {
      x: Math.min(x(policy.value) + 10, width - 2),
      y: y + 4,
      class: "chart-value-label",
      "text-anchor": x(policy.value) > width - 95 ? "end" : "start",
    });
    valueLabel.textContent = policy.value.toFixed(3);
    labels.append(valueLabel);
  });
}

function updateClock() {
  const now = new Date();
  const value = shanghaiClock.format(now);
  byId("clock").textContent = value;
  byId("footerTime").textContent = `SHANGHAI ${value.slice(0, 5)}`;
}

function formatInteger(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "—";
}

function formatMetric(value, digits = 3, signed = false) {
  if (!Number.isFinite(value)) return "—";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds)) return "ETA —";
  if (seconds < 60) return `ETA ${Math.ceil(seconds)}S`;
  if (seconds < 3600) return `ETA ${Math.ceil(seconds / 60)}M`;
  return `ETA ${(seconds / 3600).toFixed(1)}H`;
}

function setLiveChartEmpty(title, detail) {
  byId("liveChartEmptyTitle").textContent = title;
  byId("liveChartEmptyDetail").textContent = detail;
}

function renderLiveChart(
  series,
  { completed = false, run = null, exploratory = false } = {},
) {
  const shell = byId("liveMetricChart").parentElement;
  const grid = byId("liveChartGrid");
  const line = byId("liveChartLine");
  const pointsLayer = byId("liveChartPoints");
  const labels = byId("liveChartLabels");
  grid.replaceChildren();
  pointsLayer.replaceChildren();
  labels.replaceChildren();
  line.removeAttribute("d");

  const useExploitability = series.some((point) =>
    Number.isFinite(point.exploitability),
  );
  const metricKey = useExploitability ? "exploitability" : "payoff";
  const metricLabel = useExploitability ? "exploitability" : "payoff";
  const armName = run
    ? armLabels[run.arm] || String(run.arm || "").toUpperCase()
    : "Pilot";
  const runContext = run ? `${armName} · SEED ${run.seed}` : "Pilot";
  byId("liveChartTitle").textContent = completed
    ? `最近完成运行的真实 ${metricLabel} 曲线`
    : `当前训练的实时 ${metricLabel} 曲线`;
  byId("liveChartDescription").textContent = exploratory
    ? `EXPLORATORY · SINGLE ARM/SEED — ${runContext} 的真实本机 CSV 指标；不是跨 seed 汇总，也不是验证性结果。`
    : completed
      ? `${runContext} 的真实本机 CSV 指标；这里只展示这一运行，不是跨 seed 汇总。`
      : `${runContext} 的实时本机 CSV 指标。`;
  const points = series
    .filter(
      (point) =>
        Number.isFinite(point.progress) && Number.isFinite(point[metricKey]),
    )
    .slice(-100);

  if (points.length === 0) {
    shell.classList.remove("has-data");
    return;
  }

  shell.classList.add("has-data");

  const width = 980;
  const height = 220;
  const left = 54;
  const right = 24;
  const top = 22;
  const bottom = 32;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xValues = points.map((point) => point.progress);
  const yValues = points.map((point) => point[metricKey]);
  let xMin = Math.min(...xValues);
  let xMax = Math.max(...xValues);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  if (xMin === xMax) {
    xMin = Math.max(0, xMin - 1);
    xMax += 1;
  }
  if (yMin === yMax) {
    const padding = Math.max(Math.abs(yMin) * 0.08, 0.05);
    yMin -= padding;
    yMax += padding;
  } else {
    const padding = (yMax - yMin) * 0.14;
    yMin -= padding;
    yMax += padding;
  }

  const x = (value) => left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const y = (value) => top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  for (let tick = 0; tick <= 4; tick += 1) {
    const yValue = yMin + ((yMax - yMin) * tick) / 4;
    const yPosition = y(yValue);
    grid.append(
      svgNode("line", {
        x1: left,
        x2: width - right,
        y1: yPosition,
        y2: yPosition,
        class: "live-chart-grid-line",
      }),
    );
    const yLabel = svgNode("text", {
      x: left - 9,
      y: yPosition + 3,
      "text-anchor": "end",
      class: "live-chart-axis-label",
    });
    yLabel.textContent = yValue.toFixed(2);
    labels.append(yLabel);
  }

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.progress).toFixed(2)} ${y(
          point[metricKey],
        ).toFixed(2)}`,
    )
    .join(" ");
  line.setAttribute("d", path);

  points.forEach((point, index) => {
    if (index % Math.max(1, Math.ceil(points.length / 18)) !== 0 && index < points.length - 1) {
      return;
    }
    pointsLayer.append(
      svgNode("circle", {
        cx: x(point.progress),
        cy: y(point[metricKey]),
        r: index === points.length - 1 ? 4 : 2.5,
        class: "live-chart-point",
      }),
    );
  });

  const firstLabel = svgNode("text", {
    x: left,
    y: height - 10,
    class: "live-chart-axis-label",
  });
  firstLabel.textContent = formatInteger(points[0].progress);
  const lastLabel = svgNode("text", {
    x: width - right,
    y: height - 10,
    "text-anchor": "end",
    class: "live-chart-axis-label",
  });
  lastLabel.textContent = formatInteger(points.at(-1).progress);
  labels.append(firstLabel, lastLabel);
}

function resetResearchSignal(data) {
  const connection = data?.connectionState || "OFFLINE";
  const apiReachable = connection !== "OFFLINE";
  const liveChip = byId("liveDataState");

  byId("heroPhaseCode").textContent = "R2—--";
  byId("phaseNumber").textContent = "--";
  byId("phaseDial").style.setProperty("--phase-progress", "0deg");
  byId("currentPhaseLabel").textContent = "尚未启动 / AWAITING DATA";
  byId("cohortRunLabel").textContent = "EXPLORATORY RUNS";
  byId("pilotRunCount").textContent = "0 / 20 PLANNED";
  byId("researchTelemetryState").textContent = apiReachable
    ? "IDLE · NO RESEARCH PAYLOAD"
    : "OFFLINE · UNAVAILABLE";
  byId("phaseCaptionRight").textContent = apiReachable
    ? "TRAINING IDLE"
    : "STATUS UNAVAILABLE";
  const pipelineChip = byId("pipelineChip");
  const pipelineState = apiReachable ? "idle" : "offline";
  pipelineChip.className = `chip ${pipelineState}`;
  pipelineChip.dataset.state = pipelineState;
  pipelineChip.textContent = apiReachable
    ? "IDLE · NO LIVE PHASE"
    : "OFFLINE · STATUS UNAVAILABLE";

  liveChip.className = `chip ${apiReachable ? "idle" : "offline"}`;
  liveChip.textContent = apiReachable
    ? "IDLE · 尚未启动"
    : "OFFLINE · 无法确认";

  document.querySelectorAll("[data-phase]").forEach((row) => {
    row.classList.remove("complete", "active", "blocked");
    const statusNode = row.querySelector("em");
    if (statusNode) statusNode.textContent = "AWAITING DATA";
  });
  document.querySelectorAll("[data-arm-id]").forEach((card) => {
    card.dataset.status = "pending";
    const statusNode = card.querySelector("[data-arm-status]");
    if (statusNode) statusNode.textContent = "WAITING · 0/3";
  });

  byId("liveArm").textContent = apiReachable ? "尚未启动" : "STATUS UNAVAILABLE";
  byId("liveRunHeading").textContent = "实时研究数据 / Live Run";
  byId("liveSeed").textContent = "—";
  byId("liveProgress").textContent = "0 / 20 RUNS";
  byId("liveExploitability").textContent = "—";
  byId("livePayoff").textContent = "—";
  byId("liveThroughputLabel").textContent = "THROUGHPUT / ETA";
  byId("liveThroughput").textContent = "—";
  byId("liveProgressFill").style.width = "0%";
  byId("liveProgressTrack").setAttribute("aria-valuenow", "0");
  setLiveChartEmpty(
    "EXPLORATORY SERIES AWAITING START",
    "探索运行启动后这里只显示当前 arm / seed 的真实 CSV 指标。",
  );
  renderLiveChart([]);

  if (apiReachable && data?.capturedAt) {
    const captured = new Date(data.capturedAt);
    const capturedLabel = Number.isNaN(captured.getTime())
      ? "—"
      : shanghaiClock.format(captured);
    byId("lastSignal").textContent =
      `LAST API SIGNAL ${capturedLabel} CST · NO RESEARCH PAYLOAD`;
  } else {
    byId("lastSignal").textContent = "LAST SIGNAL —";
  }
  byId("disclosureLiveState").textContent = apiReachable
    ? "API 在线，但尚未收到第二阶段 research 数据；训练状态为 IDLE / 尚未启动。"
    : "当前无法连接公开 API，因此无法确认第二阶段训练状态。";
}

function applyResearchSignal(data) {
  const research = data?.research;
  const connection = data?.connectionState || "OFFLINE";
  const liveChip = byId("liveDataState");

  liveChip.className = "chip";
  if (!research) {
    resetResearchSignal(data);
    return;
  }

  const phase = research.phase;
  const run = research.currentRun;
  const completedRuns = Number(research.completedRuns);
  const totalRuns = Number(research.totalRuns);
  const isExploratory =
    research.cohort === "exploratory" ||
    research.protocolMode === "post_outcome_exploratory";
  const cohortComplete =
    totalRuns > 0 &&
    completedRuns >= totalRuns &&
    research.state !== "queued" &&
    !(research.state === "running" && phase < 7);
  const pilotComplete = !isExploratory && cohortComplete;
  const exploratoryComplete = isExploratory && cohortComplete;
  const reporting =
    isExploratory && phase === 7 && research.state === "running";
  const blocked = research.state === "blocked";
  const queued =
    !blocked && (research.state === "queued" || run?.status === "pending");
  const paused = run?.status === "paused";
  const completedSnapshot = run?.status === "complete";
  const noCandidate =
    research.selection?.status === "no_candidate_promoted" || phase === 5;
  const awaitingSelection = pilotComplete && phase === 5 && !research.selection;
  byId("heroPhaseCode").textContent = `R2—${String(phase).padStart(2, "0")}`;
  byId("phaseNumber").textContent = String(phase).padStart(2, "0");
  byId("phaseDial").style.setProperty(
    "--phase-progress",
    `${((phase / 7) * 360).toFixed(2)}deg`,
  );
  byId("currentPhaseLabel").textContent = research.phaseLabel;
  byId("cohortRunLabel").textContent = isExploratory
    ? "EXPLORATORY RUNS"
    : "PILOT RUNS";
  byId("pilotRunCount").textContent =
    `${research.completedRuns} / ${research.totalRuns} COMPLETE`;
  if (isExploratory) {
    byId("studyModeLabel").textContent =
      "POST-OUTCOME EXPLORATORY · NOT CONFIRMATORY";
  }

  const researchState = research.state.toUpperCase();
  const effectiveState =
    connection === "LIVE"
      ? blocked
        ? "blocked"
        : paused
        ? "paused"
        : queued
          ? "queued"
          : exploratoryComplete && !reporting
        ? "complete"
        : pilotComplete
        ? "complete"
        : research.state
      : connection.toLowerCase();
  liveChip.classList.add(effectiveState);
  if (connection === "LIVE" && isExploratory && blocked) {
    liveChip.textContent = "BLOCKED · PREFLIGHT FAILED";
  } else if (connection === "LIVE" && reporting) {
    liveChip.textContent = "REPORTING · EXPLORATORY";
  } else if (connection === "LIVE" && isExploratory && exploratoryComplete) {
    liveChip.textContent = "EXPLORATORY COMPLETE · REPORT SAVED";
  } else if (connection === "LIVE" && isExploratory && queued) {
    liveChip.textContent = "QUEUED · AWAITING GPU";
  } else if (connection === "LIVE" && isExploratory && paused) {
    liveChip.textContent = "PAUSED · CHECKPOINT SAVED";
  } else if (connection === "LIVE" && isExploratory && research.state === "running") {
    liveChip.textContent = "EXPLORATORY RUN · LIVE";
  } else if (connection === "LIVE" && pilotComplete) {
    liveChip.textContent = awaitingSelection
      ? "PILOT COMPLETE · AWAITING SELECTION"
      : noCandidate
        ? "NO CANDIDATE PROMOTED · COMPLETE"
        : "PILOT COMPLETE · TELEMETRY LIVE";
  } else if (connection === "LIVE" && research.state === "running") {
    liveChip.textContent = "TRAINING LIVE";
  } else if (connection === "LIVE" && research.state === "idle") {
    liveChip.textContent = "TELEMETRY LIVE · TRAINING IDLE";
  } else {
    liveChip.textContent = `${connection} · ${researchState}`;
  }
  byId("researchTelemetryState").textContent =
    connection === "LIVE" && isExploratory
      ? `LIVE · ${reporting ? "REPORTING" : researchState} · EXPLORATORY`
      : connection === "LIVE" && pilotComplete
        ? "LIVE · PILOT COMPLETE"
      : `${connection} · ${researchState}`;
  byId("phaseCaptionRight").textContent = reporting
    ? "EXPLORATORY REPORT · BUILDING"
    : isExploratory && blocked
      ? "EXTENSION BLOCKED · NO GPU START"
    : isExploratory && queued
      ? "EXTENSION QUEUED · PREFLIGHT"
      : isExploratory && paused
        ? "EXTENSION PAUSED · RESUMABLE"
        : isExploratory && exploratoryComplete
          ? "20 / 20 · REPORT SAVED"
          : awaitingSelection
            ? "PILOT COMPLETE · SELECT NEXT"
            : research.state === "running"
              ? isExploratory
                ? "EXPLORATORY · NOT CONFIRMATORY"
                : "EXPERIMENT ACTIVE"
      : `${researchState} · VERIFIED`;
  const pipelineChip = byId("pipelineChip");
  const pipelineState =
    connection === "LIVE"
      ? blocked
        ? "blocked"
        : paused
        ? "paused"
        : research.state
      : connection.toLowerCase();
  pipelineChip.className = `chip ${pipelineState}`;
  pipelineChip.dataset.state = pipelineState;
  pipelineChip.textContent =
    `${String(phase).padStart(2, "0")} / 07 ${researchState}`;

  document.querySelectorAll("[data-phase]").forEach((row) => {
    row.classList.remove("complete", "active", "blocked");
    const statusNode = row.querySelector("em");
    if (statusNode) statusNode.textContent = "PENDING";
  });
  research.milestones.forEach((milestone) => {
    const phaseNumber = Number.parseInt(milestone.id, 10);
    const row = document.querySelector(`[data-phase="${phaseNumber}"]`);
    if (!row) return;
    row.classList.remove("complete", "active", "blocked");
    if (milestone.status !== "pending") row.classList.add(milestone.status);
    const statusNode = row.querySelector("em");
    if (statusNode) statusNode.textContent = milestone.status.toUpperCase();
  });

  document.querySelectorAll("[data-arm-id]").forEach((card) => {
    card.dataset.status = "pending";
    const statusNode = card.querySelector("[data-arm-status]");
    if (!statusNode) return;
    if (
      isExploratory &&
      !["terminal", "scaled"].includes(card.dataset.armId)
    ) {
      card.dataset.status = "complete";
      statusNode.textContent = "PILOT COMPLETE · NOT EXTENDED";
    } else {
      statusNode.textContent = isExploratory
        ? "WAITING · 0/10"
        : "WAITING · 0/3";
    }
  });
  research.arms.forEach((arm) => {
    const card = document.querySelector(`[data-arm-id="${arm.id}"]`);
    if (!card) return;
    card.dataset.status = arm.status;
    const statusNode = card.querySelector("[data-arm-status]");
    if (statusNode) {
      const progress =
        arm.status === "running" ? ` · ${Math.round(arm.fraction * 100)}%` : "";
      statusNode.textContent =
        `${arm.status.toUpperCase()} · ${arm.completedRuns}/${arm.totalRuns}${progress}`;
    }
  });

  byId("liveRunHeading").textContent = isExploratory
    ? "探索延长数据 / Exploratory Run"
    : "实时研究数据 / Live Run";
  byId("liveThroughputLabel").textContent = "THROUGHPUT / ETA";
  setLiveChartEmpty(
    isExploratory ? "EXPLORATORY RUN QUEUED" : "NO TRAINING SERIES YET",
    isExploratory
      ? "当前仅展示单个 arm / seed 的真实 CSV；训练落下首个指标点后曲线才会出现。"
      : "遥测链路会保持在线；Pilot 启动后这里只显示真实 CSV 指标。",
  );
  if (run) {
    if (blocked) {
      byId("liveRunHeading").textContent = "启动受阻 / Preflight Blocked";
      byId("liveThroughputLabel").textContent = "PREFLIGHT STATUS";
      setLiveChartEmpty(
        "BLOCKED · NO GPU START",
        "安全预检未通过；GPU 未启动。修复条件并重新预检后才会进入运行态。",
      );
    } else if (completedSnapshot) {
      byId("liveRunHeading").textContent = "最近完成运行 / Latest Completed Run";
      byId("liveThroughputLabel").textContent = "RUN STATUS";
      setLiveChartEmpty(
        "COMPLETED SNAPSHOT PENDING",
        isExploratory
          ? "探索运行已完成；正在等待这一个 arm / seed 的真实 CSV 快照同步。"
          : "Pilot 已完成；正在等待最近一次真实 CSV 快照同步。",
      );
    } else if (queued) {
      byId("liveRunHeading").textContent = "下一计划运行 / Next Queued Run";
      byId("liveThroughputLabel").textContent = "QUEUE STATUS";
      setLiveChartEmpty(
        "QUEUED · NO CSV YET",
        "预检通过并启动 GPU 后，这里会显示该 arm / seed 的真实 300K 曲线。",
      );
    } else if (paused) {
      byId("liveRunHeading").textContent = "暂停运行 / Paused Run";
      byId("liveThroughputLabel").textContent = "RESUME STATUS";
    }
    byId("liveArm").textContent = armLabels[run.arm] || run.arm.toUpperCase();
    byId("liveSeed").textContent = String(run.seed);
    byId("liveProgress").textContent =
      `${formatInteger(run.progress)} / ${formatInteger(run.target)}`;
    byId("liveExploitability").textContent = formatMetric(
      run.latestExploitability,
      3,
    );
    byId("livePayoff").textContent = formatMetric(run.latestPayoff, 3, true);
    byId("liveThroughput").textContent = completedSnapshot
      ? "COMPLETE · SAVED"
      : blocked
        ? "BLOCKED · NO GPU START"
        : queued
        ? "QUEUED · AWAITING GPU"
        : paused
          ? "PAUSED · CHECKPOINT SAVED"
          : `${formatMetric(run.speed, 1)} /S · ${formatEta(run.etaSeconds)}`;
    const percent = Math.max(0, Math.min(100, run.fraction * 100));
    byId("liveProgressFill").style.width = `${percent}%`;
    byId("liveProgressTrack").setAttribute("aria-valuenow", percent.toFixed(1));
  } else if (cohortComplete) {
    byId("liveRunHeading").textContent = isExploratory
      ? "探索延长已完成 / Exploratory Complete"
      : "Pilot 已完成 / Pilot Complete";
    byId("liveArm").textContent = isExploratory
      ? reporting
        ? "REPORTING · EXPLORATORY"
        : "EXPLORATORY COMPLETE"
      : awaitingSelection
        ? "AWAITING SELECTION"
        : "PILOT COMPLETE";
    byId("liveSeed").textContent = "—";
    byId("liveProgress").textContent =
      `${research.completedRuns} / ${research.totalRuns} RUNS`;
    byId("liveExploitability").textContent = "—";
    byId("livePayoff").textContent = "—";
    byId("liveThroughputLabel").textContent = "RUN STATUS";
    byId("liveThroughput").textContent = reporting
      ? "REPORTING · EXPLORATORY"
      : "COMPLETED SNAPSHOT PENDING";
    byId("liveProgressFill").style.width = "100%";
    byId("liveProgressTrack").setAttribute("aria-valuenow", "100");
    setLiveChartEmpty(
      isExploratory ? "20 / 20 EXPLORATORY RUNS COMPLETE" : "PILOT COMPLETE",
      isExploratory
        ? "探索性延长已完成；最近一个 arm / seed 的真实 CSV 快照正在同步。"
        : "12 / 12 个 Pilot 已完成；最近运行的真实 CSV 快照正在同步。",
    );
  } else {
    byId("liveArm").textContent =
      isExploratory && research.state === "queued"
        ? "NEXT RUN SNAPSHOT PENDING"
        : research.state === "running"
          ? "STARTING RUN"
          : "NO ACTIVE RUN";
    byId("liveSeed").textContent = "—";
    byId("liveProgress").textContent =
      `${research.completedRuns} / ${research.totalRuns} RUNS`;
    byId("liveExploitability").textContent = "—";
    byId("livePayoff").textContent = "—";
    byId("liveThroughput").textContent = "—";
    byId("liveProgressFill").style.width = "0%";
    byId("liveProgressTrack").setAttribute("aria-valuenow", "0");
  }

  renderLiveChart(research.series, {
    completed: completedSnapshot || cohortComplete,
    run,
    exploratory: isExploratory,
  });
  const captured = new Date(data.capturedAt);
  const capturedLabel = Number.isNaN(captured.getTime())
    ? "—"
    : shanghaiClock.format(captured);
  const age = Number.isFinite(data.ageSeconds)
    ? `${Math.round(data.ageSeconds)}S AGO`
    : "AGE —";
  byId("lastSignal").textContent = `LAST SIGNAL ${capturedLabel} CST · ${age}`;
  byId("disclosureLiveState").textContent =
    connection === "LIVE" && isExploratory
      ? blocked
        ? "探索扩展预检未通过，GPU 没有启动；页面不会把 blocked 状态伪装成 queued 或 running。"
        : reporting
        ? "20 / 20 个探索运行已完成，正在生成明确标注为 exploratory 的报告。"
        : exploratoryComplete
          ? "探索性延长与报告已完成；结果不会被表述为验证性证据。"
          : queued
            ? "结果后探索已排队；通过 CUDA、电源、磁盘与互斥预检后才会启动 GPU。"
            : paused
              ? "探索运行已暂停，恢复点已保存；页面保留当前单 run 的真实 CSV。"
              : "结果后探索正在运行；页面只呈现当前 arm / seed 的真实 CSV，不做跨 seed 汇总。"
      : connection === "LIVE" && pilotComplete
      ? "Pilot 12 / 12 已完成；遥测在线，正在等待按预注册规则锁定候选。"
      : connection === "LIVE"
        ? research.state === "running"
          ? "训练与遥测均处于实时状态。"
          : "遥测在线，但当前没有活动训练进程。"
        : `数据链路当前为 ${connection}。`;
}

function applyComputeSignal(data) {
  const dot = byId("systemDot");
  const label = byId("systemLabel");
  const computeState = byId("computeState");
  const computeDetail = byId("computeDetail");
  const state = data.connectionState;

  if (state === "LIVE") {
    dot.className = "live";
    label.textContent = "RESEARCH LINK LIVE";
    computeState.textContent = "RTX 4060 · TELEMETRY";
  } else if (state === "COMPLETE") {
    dot.className = "locked";
    label.textContent = "BASELINE COMPLETE";
    computeState.textContent = "BASELINE COMPLETE";
  } else if (state === "DELAYED") {
    dot.className = "locked";
    label.textContent = "SIGNAL DELAYED";
    computeState.textContent = "TELEMETRY DELAYED";
  } else {
    dot.className = "offline";
    label.textContent = "COMPUTE NODE OFFLINE";
    computeState.textContent = "COMPUTE NODE OFFLINE";
  }

  if (data.gpu && state !== "OFFLINE") {
    const prefix = state === "COMPLETE" ? "FINAL SNAPSHOT · " : "";
    computeDetail.textContent =
      `${prefix}${Math.round(data.gpu.temperatureC)}°C · ` +
      `${Math.round(data.gpu.utilizationPct)}% GPU · ` +
      `${(data.gpu.memoryUsedMb / 1024).toFixed(1)} GB`;
  } else if (state === "OFFLINE" && Number.isFinite(data.ageSeconds)) {
    computeDetail.textContent = `LAST SIGNAL ${Math.round(data.ageSeconds / 60)} MIN AGO · STALE`;
  } else {
    computeDetail.textContent = "NO ACTIVE GPU TELEMETRY";
  }
}

async function refreshComputeSignal() {
  try {
    const response = await fetch("/api/rlcard/status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    const data = await response.json();
    applyComputeSignal(data);
    applyResearchSignal(data);
  } catch {
    applyComputeSignal({ connectionState: "OFFLINE", gpu: null });
    applyResearchSignal({ connectionState: "OFFLINE", research: null });
  }
}

renderExploitabilityChart();
updateClock();
setInterval(updateClock, 1_000);

let researchRefreshTimer = null;

function scheduleResearchRefresh() {
  if (researchRefreshTimer !== null) {
    clearInterval(researchRefreshTimer);
    researchRefreshTimer = null;
  }
  if (!document.hidden) {
    researchRefreshTimer = setInterval(refreshComputeSignal, 3_000);
  }
}

document.addEventListener("visibilitychange", () => {
  scheduleResearchRefresh();
  if (!document.hidden) refreshComputeSignal();
});

if (!document.hidden) refreshComputeSignal();
scheduleResearchRefresh();

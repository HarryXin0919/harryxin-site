const byId = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "ETA CALCULATING";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  return hours ? `PHASE ETA ${hours}H ${minutes}M` : `PHASE ETA ${minutes}M`;
}

function formatAge(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)} SEC`;
  return `${Math.round(seconds / 60)} MIN`;
}

function statusClass(state) {
  if (state === "LIVE" || state === "COMPLETE") return "live";
  if (state === "DELAYED") return "delayed";
  return "offline";
}

function setConnection(state) {
  const className = statusClass(state);
  byId("connectionDot").className = className;
  byId("connectionState").textContent = state;
  byId("pipelineState").className = `chip ${className}`;
  byId("pipelineState").textContent = state;
}

function updateHero(data) {
  const current = data.current;
  const percent = data.training.overallFraction * 100;
  byId("overallPercent").textContent = percent.toFixed(1);
  byId("progressOrbit").style.setProperty("--progress", `${percent * 3.6}deg`);
  byId("stageCount").textContent =
    `${data.training.completeCount} / ${data.training.stageCount} PHASES`;
  byId("etaText").textContent = formatDuration(data.training.etaSeconds);
  byId("dataAge").textContent = formatAge(data.ageSeconds);
  if (!current) {
    byId("currentTitle").textContent =
      data.connectionState === "COMPLETE" ? "实验全部完成" : "等待下一阶段";
    byId("currentMeta").textContent = "PUBLIC · SANITIZED TELEMETRY";
    byId("currentProgress").textContent = "—";
    byId("currentSpeed").textContent = "—";
    byId("currentPayoff").textContent = "—";
    return;
  }
  byId("currentTitle").textContent =
    `${current.algorithm} · SEED ${current.seed ?? "—"}`;
  byId("currentMeta").textContent =
    `${current.algorithm} · ${current.mode.toUpperCase()} · SEED ${current.seed ?? "—"}`;
  byId("currentProgress").textContent =
    `${numberFormat.format(current.progress)}/${numberFormat.format(current.target)}`;
  byId("currentSpeed").textContent = `${current.speed.toFixed(1)} /s`;
  byId("currentPayoff").textContent = current.payoff === null
    ? "—"
    : `${current.payoff >= 0 ? "+" : ""}${current.payoff.toFixed(3)}`;
}

function updateGpu(gpu) {
  if (!gpu) {
    byId("thermalState").textContent = "NO SIGNAL";
    byId("thermalState").className = "chip offline";
    return;
  }
  const memoryPercent = gpu.memoryUsedMb / gpu.memoryTotalMb * 100;
  byId("gpuTemp").textContent = Math.round(gpu.temperatureC);
  byId("gpuLoad").textContent = `${Math.round(gpu.utilizationPct)}%`;
  byId("gpuMemory").textContent =
    `${(gpu.memoryUsedMb / 1024).toFixed(1)} / ${(gpu.memoryTotalMb / 1024).toFixed(1)} GB`;
  byId("gpuPower").textContent = `${gpu.powerW.toFixed(1)} W`;
  byId("gpuLoadBar").style.width = `${Math.min(gpu.utilizationPct, 100)}%`;
  byId("gpuMemoryBar").style.width = `${Math.min(memoryPercent, 100)}%`;
  const hot = gpu.temperatureC >= 85;
  byId("thermalState").textContent = hot ? "HOT · PAUSE ADVISED" : "THERMAL NOMINAL";
  byId("thermalState").className = `chip ${hot ? "offline" : "live"}`;
}

function svgNode(name, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function updateChart(series) {
  const grid = byId("chartGrid");
  const labels = byId("chartLabels");
  const lastPoint = byId("lastPoint");
  grid.replaceChildren();
  labels.replaceChildren();
  lastPoint.replaceChildren();
  byId("chartPoints").textContent = `${series.length} POINTS`;
  if (!series.length) {
    byId("payoffLine").setAttribute("d", "");
    byId("ciBand").setAttribute("d", "");
    byId("emptyChart").hidden = false;
    return;
  }
  byId("emptyChart").hidden = true;
  const width = 760;
  const height = 260;
  const margin = { top: 18, right: 18, bottom: 30, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xMin = Math.min(...series.map((point) => point.progress));
  const xMax = Math.max(...series.map((point) => point.progress));
  const values = series.flatMap((point) => [point.mean, point.low, point.high, 0]);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const padding = Math.max((yMax - yMin) * .15, .1);
  yMin -= padding;
  yMax += padding;
  const x = (value) =>
    margin.left + (value - xMin) / Math.max(xMax - xMin, 1) * plotWidth;
  const y = (value) =>
    margin.top + (1 - (value - yMin) / Math.max(yMax - yMin, .01)) * plotHeight;
  for (let index = 0; index <= 4; index += 1) {
    const fraction = index / 4;
    const position = margin.top + fraction * plotHeight;
    grid.append(svgNode("line", {
      x1: margin.left,
      x2: width - margin.right,
      y1: position,
      y2: position,
      class: "chart-grid-line",
    }));
    const label = svgNode("text", {
      x: margin.left - 8,
      y: position + 3,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    label.textContent = (yMax - fraction * (yMax - yMin)).toFixed(2);
    labels.append(label);
  }
  [0, .5, 1].forEach((fraction) => {
    const label = svgNode("text", {
      x: margin.left + fraction * plotWidth,
      y: height - 7,
      "text-anchor": fraction === 0 ? "start" : fraction === 1 ? "end" : "middle",
      class: "chart-axis-label",
    });
    label.textContent = numberFormat.format(xMin + fraction * (xMax - xMin));
    labels.append(label);
  });
  const upper = series.map((point) => `${x(point.progress)},${y(point.high)}`);
  const lower = [...series].reverse().map((point) => `${x(point.progress)},${y(point.low)}`);
  byId("ciBand").setAttribute("d", `M${upper.join(" L")} L${lower.join(" L")} Z`);
  byId("payoffLine").setAttribute(
    "d",
    series.map((point, index) =>
      `${index ? "L" : "M"}${x(point.progress)},${y(point.mean)}`).join(" "),
  );
  const latest = series.at(-1);
  lastPoint.append(svgNode("circle", {
    cx: x(latest.progress),
    cy: y(latest.mean),
    r: 5,
    class: "chart-point",
  }));
}

function stageRow(stage, index) {
  const row = document.createElement("div");
  row.className = `stage-row ${stage.status}`;
  const indexNode = document.createElement("span");
  indexNode.className = "stage-index";
  indexNode.textContent = String(index + 1).padStart(2, "0");
  const name = document.createElement("span");
  name.className = "stage-name";
  const nameStrong = document.createElement("strong");
  nameStrong.textContent = stage.label;
  const nameSmall = document.createElement("small");
  nameSmall.textContent = `${stage.algorithm} · ${stage.mode.toUpperCase()}`;
  name.append(nameStrong, nameSmall);
  const progress = document.createElement("span");
  progress.className = "stage-progress";
  progress.textContent =
    `${numberFormat.format(stage.progress)} / ${numberFormat.format(stage.target)}`;
  const track = document.createElement("span");
  track.className = "mini-track";
  const fill = document.createElement("i");
  fill.style.width = `${Math.min(stage.fraction * 100, 100)}%`;
  track.append(fill);
  const status = document.createElement("span");
  status.className = "stage-status";
  status.textContent = {
    complete: "COMPLETE",
    running: "RUNNING",
    paused: "PAUSED",
    pending: "QUEUED",
  }[stage.status];
  row.append(indexNode, name, progress, track, status);
  return row;
}

function updateStages(stages) {
  const fragment = document.createDocumentFragment();
  stages.forEach((stage, index) => fragment.append(stageRow(stage, index)));
  byId("stageList").replaceChildren(fragment);
}

function render(data) {
  setConnection(data.connectionState);
  byId("clock").textContent = timeFormat.format(new Date(data.serverTime));
  byId("lastUpdated").textContent =
    `LAST UPDATE ${timeFormat.format(new Date(data.capturedAt))}`;
  updateHero(data);
  updateGpu(data.gpu);
  updateChart(data.series || []);
  updateStages(data.stages || []);
  if (data.connectionState === "OFFLINE") {
    byId("statusNotice").textContent =
      "训练电脑超过两分钟没有上传数据。最后一次公开状态仍被保留，训练本身可能仍在本地运行。";
  } else if (data.connectionState === "DELAYED") {
    byId("statusNotice").textContent =
      "遥测数据出现短暂延迟；页面正在自动重试，不会向训练电脑发出任何控制指令。";
  }
}

async function refresh() {
  try {
    const response = await fetch("/api/rlcard/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`Telemetry API returned ${response.status}`);
    render(await response.json());
  } catch {
    setConnection("OFFLINE");
    byId("currentTitle").textContent = "遥测暂时不可用";
    byId("currentMeta").textContent = "RETRYING AUTOMATICALLY";
    byId("statusNotice").textContent =
      "云端暂时没有可用的训练状态。页面每 3 秒自动重试；这不代表本地训练已经停止。";
  }
}

refresh();
setInterval(refresh, 3000);

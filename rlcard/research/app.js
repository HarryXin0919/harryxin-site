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

function applyComputeSignal(data) {
  const dot = byId("systemDot");
  const label = byId("systemLabel");
  const computeState = byId("computeState");
  const computeDetail = byId("computeDetail");
  const state = data.connectionState;

  if (state === "LIVE") {
    dot.className = "live";
    label.textContent = "COMPUTE NODE LIVE";
    computeState.textContent = "RTX 4060 · ONLINE";
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
    applyComputeSignal(await response.json());
  } catch {
    applyComputeSignal({ connectionState: "OFFLINE", gpu: null });
  }
}

renderExploitabilityChart();
updateClock();
refreshComputeSignal();
setInterval(updateClock, 1_000);
setInterval(refreshComputeSignal, 10_000);

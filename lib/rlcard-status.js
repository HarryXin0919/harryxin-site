const ALGORITHMS = new Set(["DQN", "NFSP", "CFR", "EVAL", "REPORT"]);
const MODES = new Set(["random-opponent", "self-play", "round-robin", "report"]);
const STAGE_STATES = new Set(["complete", "running", "paused", "pending"]);
const RESEARCH_STATES = new Set(["running", "idle", "complete", "blocked"]);
const RESEARCH_RUN_STATES = new Set(["running", "complete", "paused", "pending"]);
const RESEARCH_MILESTONE_STATES = new Set(["complete", "active", "pending", "blocked"]);
const RESEARCH_COHORTS = new Set(["pilot", "confirmation"]);
const RESEARCH_ARMS = new Set([
  "terminal",
  "scaled",
  "pbrs-cfr-a010",
  "pbrs-cfr-a025",
]);

export class StatusValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "StatusValidationError";
  }
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StatusValidationError(`${label} must be an object`);
  }
  return value;
}

function number(value, label, { min = -Infinity, max = Infinity, optional = false } = {}) {
  if ((value === null || value === undefined) && optional) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new StatusValidationError(`${label} must be a finite number`);
  }
  if (value < min || value > max) {
    throw new StatusValidationError(`${label} is outside the accepted range`);
  }
  return value;
}

function integer(value, label, options = {}) {
  const result = number(value, label, options);
  if (result !== null && !Number.isInteger(result)) {
    throw new StatusValidationError(`${label} must be an integer`);
  }
  return result;
}

function text(value, label, { maxLength = 100, optional = false } = {}) {
  if ((value === null || value === undefined) && optional) return null;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new StatusValidationError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function enumValue(value, label, allowed) {
  const result = text(value, label);
  if (!allowed.has(result)) {
    throw new StatusValidationError(`${label} has an unsupported value`);
  }
  return result;
}

function boolean(value, label) {
  if (typeof value !== "boolean") {
    throw new StatusValidationError(`${label} must be a boolean`);
  }
  return value;
}

function isoTimestamp(value, label) {
  const result = text(value, label, { maxLength: 40 });
  const timestamp = Date.parse(result);
  if (!Number.isFinite(timestamp)) {
    throw new StatusValidationError(`${label} must be an ISO timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function sanitizeCurrent(value) {
  if (value === null) return null;
  const current = plainObject(value, "current");
  return {
    algorithm: enumValue(current.algorithm, "current.algorithm", ALGORITHMS),
    mode: enumValue(current.mode, "current.mode", MODES),
    seed: integer(current.seed, "current.seed", {
      min: 0,
      max: 2_147_483_647,
      optional: true,
    }),
    progress: integer(current.progress, "current.progress", { min: 0, max: 1_000_000_000 }),
    target: integer(current.target, "current.target", { min: 1, max: 1_000_000_000 }),
    payoff: number(current.payoff, "current.payoff", { min: -100, max: 100, optional: true }),
    ciLow: number(current.ciLow, "current.ciLow", { min: -100, max: 100, optional: true }),
    ciHigh: number(current.ciHigh, "current.ciHigh", {
      min: -100,
      max: 100,
      optional: true,
    }),
    speed: number(current.speed, "current.speed", { min: 0, max: 10_000_000 }),
  };
}

function sanitizeGpu(value) {
  if (value === null) return null;
  const gpu = plainObject(value, "gpu");
  return {
    utilizationPct: number(gpu.utilizationPct, "gpu.utilizationPct", { min: 0, max: 100 }),
    memoryUsedMb: number(gpu.memoryUsedMb, "gpu.memoryUsedMb", { min: 0, max: 1_000_000 }),
    memoryTotalMb: number(gpu.memoryTotalMb, "gpu.memoryTotalMb", { min: 1, max: 1_000_000 }),
    temperatureC: number(gpu.temperatureC, "gpu.temperatureC", { min: -20, max: 120 }),
    powerW: number(gpu.powerW, "gpu.powerW", { min: 0, max: 2_000 }),
  };
}

function sanitizeStages(value) {
  if (!Array.isArray(value) || value.length > 32) {
    throw new StatusValidationError("stages must be an array with at most 32 entries");
  }
  return value.map((item, index) => {
    const stage = plainObject(item, `stages[${index}]`);
    return {
      label: text(stage.label, `stages[${index}].label`, { maxLength: 80 }),
      algorithm: enumValue(stage.algorithm, `stages[${index}].algorithm`, ALGORITHMS),
      mode: enumValue(stage.mode, `stages[${index}].mode`, MODES),
      seed: integer(stage.seed, `stages[${index}].seed`, {
        min: 0,
        max: 2_147_483_647,
        optional: true,
      }),
      progress: integer(stage.progress, `stages[${index}].progress`, {
        min: 0,
        max: 1_000_000_000,
      }),
      target: integer(stage.target, `stages[${index}].target`, {
        min: 1,
        max: 1_000_000_000,
      }),
      fraction: number(stage.fraction, `stages[${index}].fraction`, { min: 0, max: 1 }),
      status: enumValue(stage.status, `stages[${index}].status`, STAGE_STATES),
    };
  });
}

function sanitizeSeries(value) {
  if (!Array.isArray(value) || value.length > 100) {
    throw new StatusValidationError("series must be an array with at most 100 entries");
  }
  return value.map((item, index) => {
    const point = plainObject(item, `series[${index}]`);
    return {
      progress: number(point.progress, `series[${index}].progress`, {
        min: 0,
        max: 1_000_000_000,
      }),
      mean: number(point.mean, `series[${index}].mean`, { min: -100, max: 100 }),
      low: number(point.low, `series[${index}].low`, { min: -100, max: 100 }),
      high: number(point.high, `series[${index}].high`, { min: -100, max: 100 }),
    };
  });
}

function sanitizeResearchRun(value) {
  if (value === null || value === undefined) return null;
  const run = plainObject(value, "research.currentRun");
  const sanitized = {
    cohort: enumValue(run.cohort, "research.currentRun.cohort", RESEARCH_COHORTS),
    arm: enumValue(run.arm, "research.currentRun.arm", RESEARCH_ARMS),
    seed: integer(run.seed, "research.currentRun.seed", {
      min: 0,
      max: 2_147_483_647,
    }),
    progress: integer(run.progress, "research.currentRun.progress", {
      min: 0,
      max: 1_000_000_000,
    }),
    target: integer(run.target, "research.currentRun.target", {
      min: 1,
      max: 1_000_000_000,
    }),
    fraction: number(run.fraction, "research.currentRun.fraction", { min: 0, max: 1 }),
    speed: number(run.speed, "research.currentRun.speed", { min: 0, max: 10_000_000 }),
    etaSeconds: number(run.etaSeconds, "research.currentRun.etaSeconds", {
      min: 0,
      max: 31_536_000,
      optional: true,
    }),
    latestExploitability: number(
      run.latestExploitability,
      "research.currentRun.latestExploitability",
      { min: 0, max: 100, optional: true },
    ),
    latestPayoff: number(run.latestPayoff, "research.currentRun.latestPayoff", {
      min: -100,
      max: 100,
      optional: true,
    }),
    status: enumValue(run.status, "research.currentRun.status", RESEARCH_RUN_STATES),
  };
  if (sanitized.progress > sanitized.target) {
    throw new StatusValidationError(
      "research.currentRun.progress cannot exceed its target",
    );
  }
  return sanitized;
}

function sanitizeResearchArms(value) {
  if (!Array.isArray(value) || value.length > 4) {
    throw new StatusValidationError("research.arms must contain at most four entries");
  }
  return value.map((item, index) => {
    const arm = plainObject(item, `research.arms[${index}]`);
    const totalRuns = integer(arm.totalRuns, `research.arms[${index}].totalRuns`, {
      min: 1,
      max: 100,
    });
    const completedRuns = integer(
      arm.completedRuns,
      `research.arms[${index}].completedRuns`,
      { min: 0, max: totalRuns },
    );
    const sanitized = {
      id: enumValue(arm.id, `research.arms[${index}].id`, RESEARCH_ARMS),
      label: text(arm.label, `research.arms[${index}].label`, { maxLength: 40 }),
      status: enumValue(
        arm.status,
        `research.arms[${index}].status`,
        RESEARCH_RUN_STATES,
      ),
      completedRuns,
      totalRuns,
      progress: integer(arm.progress, `research.arms[${index}].progress`, {
        min: 0,
        max: 1_000_000_000,
      }),
      target: integer(arm.target, `research.arms[${index}].target`, {
        min: 1,
        max: 1_000_000_000,
      }),
      fraction: number(arm.fraction, `research.arms[${index}].fraction`, {
        min: 0,
        max: 1,
      }),
      latestExploitability: number(
        arm.latestExploitability,
        `research.arms[${index}].latestExploitability`,
        { min: 0, max: 100, optional: true },
      ),
      latestPayoff: number(
        arm.latestPayoff,
        `research.arms[${index}].latestPayoff`,
        { min: -100, max: 100, optional: true },
      ),
    };
    if (sanitized.progress > sanitized.target) {
      throw new StatusValidationError(
        `research.arms[${index}].progress cannot exceed its target`,
      );
    }
    return sanitized;
  });
}

function sanitizeResearchSeries(value) {
  if (!Array.isArray(value) || value.length > 100) {
    throw new StatusValidationError("research.series must contain at most 100 entries");
  }
  return value.map((item, index) => {
    const point = plainObject(item, `research.series[${index}]`);
    const exploitability = number(
      point.exploitability,
      `research.series[${index}].exploitability`,
      { min: 0, max: 100, optional: true },
    );
    const payoff = number(point.payoff, `research.series[${index}].payoff`, {
      min: -100,
      max: 100,
      optional: true,
    });
    if (exploitability === null && payoff === null) {
      throw new StatusValidationError(
        `research.series[${index}] must include exploitability or payoff`,
      );
    }
    return {
      arm: enumValue(point.arm, `research.series[${index}].arm`, RESEARCH_ARMS),
      seed: integer(point.seed, `research.series[${index}].seed`, {
        min: 0,
        max: 2_147_483_647,
      }),
      progress: number(point.progress, `research.series[${index}].progress`, {
        min: 0,
        max: 1_000_000_000,
      }),
      exploitability,
      payoff,
    };
  });
}

function sanitizeResearchMilestones(value) {
  if (!Array.isArray(value) || value.length > 7) {
    throw new StatusValidationError(
      "research.milestones must contain at most seven entries",
    );
  }
  return value.map((item, index) => {
    const milestone = plainObject(item, `research.milestones[${index}]`);
    return {
      id: text(milestone.id, `research.milestones[${index}].id`, { maxLength: 8 }),
      label: text(milestone.label, `research.milestones[${index}].label`, {
        maxLength: 80,
      }),
      status: enumValue(
        milestone.status,
        `research.milestones[${index}].status`,
        RESEARCH_MILESTONE_STATES,
      ),
    };
  });
}

function sanitizeResearch(value) {
  if (value === null || value === undefined) return null;
  const research = plainObject(value, "research");
  const totalRuns = integer(research.totalRuns, "research.totalRuns", {
    min: 1,
    max: 1_000,
  });
  return {
    studyId: text(research.studyId, "research.studyId", { maxLength: 80 }),
    phase: integer(research.phase, "research.phase", { min: 1, max: 7 }),
    phaseLabel: text(research.phaseLabel, "research.phaseLabel", { maxLength: 80 }),
    state: enumValue(research.state, "research.state", RESEARCH_STATES),
    completedRuns: integer(research.completedRuns, "research.completedRuns", {
      min: 0,
      max: totalRuns,
    }),
    totalRuns,
    currentRun: sanitizeResearchRun(research.currentRun),
    arms: sanitizeResearchArms(research.arms),
    series: sanitizeResearchSeries(research.series),
    milestones: sanitizeResearchMilestones(research.milestones),
  };
}

export function sanitizeStatus(input) {
  const root = plainObject(input, "status");
  if (root.schemaVersion !== 1) {
    throw new StatusValidationError("schemaVersion must equal 1");
  }
  const training = plainObject(root.training, "training");
  const stageCount = integer(training.stageCount, "training.stageCount", { min: 1, max: 100 });
  const completeCount = integer(training.completeCount, "training.completeCount", {
    min: 0,
    max: stageCount,
  });
  const sanitized = {
    schemaVersion: 1,
    capturedAt: isoTimestamp(root.capturedAt, "capturedAt"),
    training: {
      alive: boolean(training.alive, "training.alive"),
      overallFraction: number(training.overallFraction, "training.overallFraction", {
        min: 0,
        max: 1,
      }),
      completeCount,
      stageCount,
      etaSeconds: number(training.etaSeconds, "training.etaSeconds", {
        min: 0,
        max: 31_536_000,
        optional: true,
      }),
    },
    current: sanitizeCurrent(root.current),
    gpu: sanitizeGpu(root.gpu),
    stages: sanitizeStages(root.stages),
    series: sanitizeSeries(root.series),
  };
  const research = sanitizeResearch(root.research);
  if (research !== null) {
    sanitized.research = research;
  }
  return sanitized;
}

export function decorateStatus(status, now = new Date()) {
  const serverTime = now.toISOString();
  const ageSeconds = Math.max(0, (now.getTime() - Date.parse(status.capturedAt)) / 1_000);
  let connectionState;
  const researchComplete =
    status.research?.state === "complete" && status.research.phase === 7;
  const legacyComplete =
    !status.research &&
    !status.training.alive &&
    status.training.completeCount === status.training.stageCount;
  if (researchComplete || legacyComplete) {
    connectionState = "COMPLETE";
  } else if (ageSeconds <= 30) {
    connectionState = "LIVE";
  } else if (ageSeconds <= 120) {
    connectionState = "DELAYED";
  } else {
    connectionState = "OFFLINE";
  }
  return {
    ...status,
    serverTime,
    ageSeconds,
    connectionState,
  };
}

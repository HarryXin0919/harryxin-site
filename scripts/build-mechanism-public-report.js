import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STUDY_ID = "leduc-reward-mechanism-scale-pbrs-v1";
const SOURCE_STUDY_ID = "leduc-reward-exploratory-scaled-v1";
const ANALYSIS_TYPE = "post_outcome_mechanism_screening";
const ARMS = [
  "terminal",
  "scaled",
  "scaled-pbrs-cfr-a025",
  "unscaled-pbrs-cfr-a175",
];
const SEEDS = [47982, 81425, 45579, 34975, 86195, 68642, 31659, 54386];
const PRIVATE_KEY = /(path|checkpoint|provenance|revision|sha256|hash|stderr|stdout|(?:^|_)(?:pid|log|logs)(?:$|_))/i;

function publicTree(value, label, seen = new Set()) {
  if (value === null && label === "promotion.selectedArm") return null;
  if (value === null || value === undefined) {
    throw new TypeError(`${label} cannot contain null values`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
    seen.add("number");
    return value;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > 1_000) throw new TypeError(`${label} is too long`);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 1_000) throw new TypeError(`${label} is too large`);
    return value.map((entry, index) => publicTree(entry, `${label}[${index}]`, seen));
  }
  if (typeof value !== "object") throw new TypeError(`${label} has an unsupported value`);
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (PRIVATE_KEY.test(key)) throw new TypeError(`${label} contains a private field`);
    result[key] = publicTree(entry, `${label}.${key}`, seen);
  }
  return result;
}

function sameMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === expected.length && expected.every((value) => actual.includes(value));
}

export function buildPublicMechanismReport(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("Mechanism report source must be an object");
  }
  if (
    source.schemaVersion !== 1 || source.studyId !== STUDY_ID ||
    source.sourceStudyId !== SOURCE_STUDY_ID || source.analysisType !== ANALYSIS_TYPE ||
    source.confirmatory !== false || source.completedRuns !== 32 ||
    source.totalEpisodes !== 3_200_000 || !sameMembers(source.arms, ARMS) ||
    !sameMembers(source.seeds, SEEDS)
  ) {
    throw new TypeError("Mechanism report source does not match the frozen public contract");
  }
  if (
    !source.promotion ||
    !["candidate_advanced", "no_candidate_advanced"].includes(source.promotion.status) ||
    source.promotion.automaticConfirmationAuthorized !== false
  ) {
    throw new TypeError("Mechanism promotion decision is invalid");
  }
  const selected = source.promotion.selectedArm;
  if (
    (source.promotion.status === "candidate_advanced" &&
      !["scaled-pbrs-cfr-a025", "unscaled-pbrs-cfr-a175"].includes(selected)) ||
    (source.promotion.status === "no_candidate_advanced" && selected !== null)
  ) {
    throw new TypeError("Mechanism selected arm contradicts the promotion status");
  }
  const seen = new Set();
  const metrics = publicTree(source.metrics, "metrics", seen);
  if (!seen.has("number")) throw new TypeError("Mechanism report contains no finite metrics");
  const claimLimit = typeof source.claimLimit === "string" ? source.claimLimit.trim() : "";
  if (!claimLimit) throw new TypeError("Mechanism report claim limit is missing");

  return {
    schemaVersion: 1,
    studyId: STUDY_ID,
    sourceStudyId: SOURCE_STUDY_ID,
    analysisType: ANALYSIS_TYPE,
    confirmatory: false,
    generatedAt: String(source.generatedAt || ""),
    arms: [...ARMS],
    seeds: [...SEEDS],
    completedRuns: 32,
    totalEpisodes: 3_200_000,
    primaryEndpoint: publicTree(source.primaryEndpoint, "primaryEndpoint"),
    metrics,
    promotion: publicTree(source.promotion, "promotion"),
    claimLimit,
  };
}

async function main() {
  const [inputArgument, outputArgument = "rlcard/research/mechanism-report-v1.json"] = process.argv.slice(2);
  if (!inputArgument) {
    throw new Error(
      "Usage: node scripts/build-mechanism-public-report.js <mechanism_report.json> [output.json]",
    );
  }
  const input = resolve(inputArgument);
  const output = resolve(outputArgument);
  const source = JSON.parse(await readFile(input, "utf8"));
  const publicReport = buildPublicMechanismReport(source);
  const temporary = `${output}.tmp`;
  await writeFile(temporary, `${JSON.stringify(publicReport, null, 2)}\n`, "utf8");
  await rename(temporary, output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

import { Redis } from "@upstash/redis";
import { createStatusHandler } from "../../lib/rlcard-api.js";

const redis = Redis.fromEnv();
const store = {
  get: (key) => redis.get(key),
  set: (key, value) => redis.set(key, value),
};

export default createStatusHandler({
  store,
  ingestToken: process.env.RLCARD_INGEST_TOKEN,
});

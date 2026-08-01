import { Redis } from "@upstash/redis";
import { createStatusHandler } from "../../lib/rlcard-api.js";

const redis = new Redis({
  url:
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL,
  token:
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN,
});
const store = {
  get: (key) => redis.get(key),
  set: (key, value) => redis.set(key, value),
};

export default createStatusHandler({
  store,
  ingestToken: process.env.RLCARD_INGEST_TOKEN,
});

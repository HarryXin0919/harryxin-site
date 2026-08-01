import { timingSafeEqual } from "node:crypto";
import {
  StatusValidationError,
  decorateStatus,
  sanitizeStatus,
} from "./rlcard-status.js";

const MAX_BODY_BYTES = 128 * 1024;
const REDIS_KEY = "rlcard:status:latest";

function send(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.end(JSON.stringify(payload));
}

function tokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const prefix = "Bearer ";
  if (!actual.startsWith(prefix)) return false;
  const supplied = Buffer.from(actual.slice(prefix.length), "utf8");
  const required = Buffer.from(expected, "utf8");
  return supplied.length === required.length && timingSafeEqual(supplied, required);
}

function parseBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  if (typeof request.body === "string" || Buffer.isBuffer(request.body)) {
    return JSON.parse(request.body.toString());
  }
  throw new StatusValidationError("request body must be JSON");
}

function storedObject(value) {
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

export function createStatusHandler({
  store,
  ingestToken,
  now = () => new Date(),
}) {
  return async function statusHandler(request, response) {
    if (request.method === "GET") {
      try {
        const stored = storedObject(await store.get(REDIS_KEY));
        if (!stored) {
          send(response, 503, {
            error: "status_unavailable",
            message: "No RLCard telemetry has been published yet.",
          });
          return;
        }
        send(
          response,
          200,
          decorateStatus(sanitizeStatus(stored), now()),
          "public, s-maxage=2, stale-while-revalidate=5",
        );
      } catch {
        send(response, 503, {
          error: "status_store_unavailable",
          message: "RLCard telemetry is temporarily unavailable.",
        });
      }
      return;
    }

    if (request.method === "POST") {
      if (!tokenMatches(request.headers.authorization, ingestToken)) {
        send(response, 401, {
          error: "unauthorized",
          message: "A valid ingestion token is required.",
        });
        return;
      }
      const declaredLength = Number(request.headers["content-length"] || 0);
      if (declaredLength > MAX_BODY_BYTES) {
        send(response, 413, { error: "payload_too_large" });
        return;
      }
      try {
        const raw = parseBody(request);
        if (Buffer.byteLength(JSON.stringify(raw), "utf8") > MAX_BODY_BYTES) {
          send(response, 413, { error: "payload_too_large" });
          return;
        }
        const sanitized = sanitizeStatus(raw);
        await store.set(REDIS_KEY, sanitized);
        send(response, 202, {
          accepted: true,
          capturedAt: sanitized.capturedAt,
        });
      } catch (error) {
        if (error instanceof StatusValidationError || error instanceof SyntaxError) {
          send(response, 400, {
            error: "invalid_status",
            message: error.message,
          });
        } else {
          send(response, 503, {
            error: "status_store_unavailable",
            message: "RLCard telemetry could not be stored.",
          });
        }
      }
      return;
    }

    response.setHeader("Allow", "GET, POST");
    send(response, 405, { error: "method_not_allowed" });
  };
}

export { MAX_BODY_BYTES, REDIS_KEY };

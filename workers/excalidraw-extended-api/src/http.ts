import type { Context, Next } from "hono";

import { ApiError } from "./types";

import type { Env } from "./types";

export const MAX_JSON_BYTES = 5 * 1024 * 1024;

export const getRequestId = (c: Context<{ Bindings: Env }>) =>
  c.req.header("cf-ray") || c.req.header("x-request-id") || crypto.randomUUID();

export const getAllowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS || "https://draw.nikitayugov.com")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const corsMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  const origin = c.req.header("Origin");
  const allowedOrigins = getAllowedOrigins(c.env);
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  if (isAllowedOrigin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }

  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  c.header("Access-Control-Max-Age", "86400");

  if (c.req.method === "OPTIONS") {
    return c.body(null, isAllowedOrigin ? 204 : 403);
  }

  await next();
};

export const parseJsonBody = async <T>(
  c: Context,
  maxBytes = MAX_JSON_BYTES,
) => {
  const contentLength = c.req.header("Content-Length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new ApiError(413, "payload_too_large", "Request body is too large.");
  }

  const body = await c.req.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new ApiError(413, "payload_too_large", "Request body is too large.");
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError(400, "invalid_request", "Request body must be JSON.");
  }
};

export const getBearerToken = (c: Context) => {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    throw new ApiError(401, "missing_token", "Missing Authorization header.");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError(401, "missing_token", "Expected a bearer token.");
  }

  return match[1];
};

export const jsonError = (
  c: Context<{ Bindings: Env }>,
  error: ApiError,
  requestId: string,
) =>
  c.json(
    {
      error: error.code,
      message: error.message,
      requestId,
      retryAfterSeconds: error.retryAfterSeconds,
      currentRevision: error.currentRevision,
      currentContentHash: error.currentContentHash,
    },
    error.status as Parameters<typeof c.json>[1],
  );

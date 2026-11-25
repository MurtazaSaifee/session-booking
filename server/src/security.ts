import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { ErrorCode } from "./errors.js";

const AUTH_WINDOW_MS = 15 * 60_000;
const AUTH_MAX_REQUESTS = 15;
const API_WINDOW_MS = 60_000;
const API_MAX_REQUESTS = 120;

// Rejects requests that skip CloudFront and hit the Lambda Function URL directly.
export function verifyOriginSecret(expected: string): RequestHandler {
  const expectedBuf = Buffer.from(expected, "utf8");
  return (req, res, next) => {
    const received = req.get("x-origin-verify");
    if (!received) {
      res.status(403).json({ error: ErrorCode.FORBIDDEN, message: "Forbidden." });
      return;
    }
    const receivedBuf = Buffer.from(received, "utf8");
    if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
      res.status(403).json({ error: ErrorCode.FORBIDDEN, message: "Forbidden." });
      return;
    }
    next();
  };
}

// CloudFront passes the viewer IP and port in CloudFront-Viewer-Address (e.g. "203.0.113.10:54321").
export function extractViewerIp(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (isIP(trimmed)) return trimmed;

  const bracketed = trimmed.match(/^\[([^\]]+)\]:\d+$/);
  if (bracketed && isIP(bracketed[1])) return bracketed[1];

  const lastColon = trimmed.lastIndexOf(":");
  if (lastColon > 0) {
    const host = trimmed.slice(0, lastColon);
    const port = trimmed.slice(lastColon + 1);
    if (/^\d+$/.test(port) && isIP(host)) return host;
  }
  return null;
}

export function clientIp(req: Request, behindCloudFront: boolean): string {
  if (behindCloudFront) {
    const viewerIp = extractViewerIp(req.get("cloudfront-viewer-address"));
    if (viewerIp) return viewerIp;
  }
  return req.ip ?? req.socket.remoteAddress ?? "127.0.0.1";
}

function makeLimiter(windowMs: number, limit: number, behindCloudFront: boolean): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req) => ipKeyGenerator(clientIp(req, behindCloudFront)),
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: ErrorCode.RATE_LIMITED, message: "Too many requests. Please try again later." });
    },
  });
}

export function createRateLimiters(behindCloudFront: boolean): {
  apiLimiter: RequestHandler;
  authLimiter: RequestHandler;
} {
  return {
    apiLimiter: makeLimiter(API_WINDOW_MS, API_MAX_REQUESTS, behindCloudFront),
    authLimiter: makeLimiter(AUTH_WINDOW_MS, AUTH_MAX_REQUESTS, behindCloudFront),
  };
}

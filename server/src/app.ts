import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { authRoutes } from "./auth/routes.js";
import { bookingRoutes } from "./booking/routes.js";
import { directoryRoutes } from "./directory/routes.js";
import { healthRoutes } from "./health/routes.js";
import { notificationRoutes } from "./notifications/routes.js";
import { API_V1 } from "./paths.js";
import { sessionRoutes } from "./sessions/routes.js";
import { settingsRoutes } from "./settings/routes.js";
import { slotRoutes } from "./slots/routes.js";
import { ErrorCode, HttpError } from "./errors.js";
import { createRateLimiters, verifyOriginSecret } from "./security.js";
import type { Db } from "./db.js";

export type AppDeps = {
  db: Db;
  // Every business rule reads the time from here, so tests can control it.
  now: () => Date;
  jwtSecret: string;
  secureCookies: boolean;
  staticDir?: string;
  originVerifySecret?: string;
  rateLimit?: boolean;
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  if (deps.originVerifySecret) {
    app.use("/api", verifyOriginSecret(deps.originVerifySecret));
  }

  // With SameSite cookies, this blocks cross-site form posts (a CSRF defence).
  app.use("/api", (req, res, next) => {
    const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    if (mutating && !req.is("application/json")) {
      res
        .status(415)
        .json({ error: ErrorCode.UNSUPPORTED_MEDIA_TYPE, message: "Requests must be sent as JSON." });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  const v1 = express.Router();
  if (deps.rateLimit) {
    const { apiLimiter, authLimiter } = createRateLimiters(Boolean(deps.originVerifySecret));
    v1.use(apiLimiter);
    v1.use("/auth/login", authLimiter);
    v1.use("/auth/signup", authLimiter);
  }

  v1.use("/health", healthRoutes(deps));
  v1.use("/auth", authRoutes(deps));
  v1.use("/settings", settingsRoutes(deps));
  v1.use("/professionals", slotRoutes(deps));
  v1.use("/professionals", directoryRoutes(deps));
  v1.use("/sessions", bookingRoutes(deps));
  v1.use("/sessions", sessionRoutes(deps));
  v1.use("/notifications", notificationRoutes(deps));

  app.use(API_V1, v1);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: ErrorCode.NOT_FOUND, message: "Not found." });
  });

  if (deps.staticDir) {
    app.use(express.static(deps.staticDir));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.sendFile("index.html", { root: deps.staticDir }, (err) => {
        if (err) next(err);
      });
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
      res.status(400).json({ error: ErrorCode.VALIDATION, message: "The request body isn't valid JSON." });
      return;
    }
    if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.too.large") {
      res.status(413).json({ error: ErrorCode.VALIDATION, message: "Request body is too large." });
      return;
    }
    console.error(err);
    res.status(500).json({ error: ErrorCode.INTERNAL, message: "Something went wrong." });
  });

  return app;
}

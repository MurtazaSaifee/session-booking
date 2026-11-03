import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { authRoutes } from "./auth/routes.js";
import { healthRoutes } from "./health/routes.js";
import { API_V1 } from "./paths.js";
import { settingsRoutes } from "./settings/routes.js";
import { ErrorCode, HttpError } from "./errors.js";
import type { Db } from "./db.js";

export type AppDeps = {
  db: Db;
  // Every business rule reads the time from here, so tests can control it.
  now: () => Date;
  jwtSecret: string;
  secureCookies: boolean;
};

export function createApp(deps: AppDeps) {
  const app = express();

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
  app.use(express.json());
  app.use(cookieParser());

  const v1 = express.Router();

  v1.use("/health", healthRoutes(deps));
  v1.use("/auth", authRoutes(deps));
  v1.use("/settings", settingsRoutes(deps));

  app.use(API_V1, v1);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: ErrorCode.NOT_FOUND, message: "Not found." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message });
      return;
    }
    if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
      res.status(400).json({ error: ErrorCode.VALIDATION, message: "The request body isn't valid JSON." });
      return;
    }
    console.error(err);
    res.status(500).json({ error: ErrorCode.INTERNAL, message: "Something went wrong." });
  });

  return app;
}

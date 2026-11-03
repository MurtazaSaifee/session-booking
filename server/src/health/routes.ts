import express from "express";
import type { AppDeps } from "../app.js";
import { ErrorCode } from "../errors.js";

export function healthRoutes({ db, now }: AppDeps): express.Router {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    try {
      await db.raw("select 1");
      res.json({ status: "ok", time: now().toISOString() });
    } catch {
      res.status(503).json({ error: ErrorCode.DATABASE_UNAVAILABLE, message: "Can't reach the database." });
    }
  });

  return router;
}

import express from "express";
import type { Db } from "./db.js";

export type AppDeps = {
  db: Db;
  // Every business rule reads the time from here, so tests can control it.
  now: () => Date;
};

export function createApp({ db, now }: AppDeps) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    try {
      await db.query("select 1");
      res.json({ status: "ok", time: now().toISOString() });
    } catch {
      res.status(503).json({ error: "DATABASE_UNAVAILABLE", message: "Can't reach the database." });
    }
  });

  return app;
}

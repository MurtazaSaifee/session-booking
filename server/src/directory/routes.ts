import express from "express";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth/session.js";
import { Role } from "../roles.js";
import { listProfessionals } from "./store.js";

export function directoryRoutes(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(requireRole(deps, Role.MEMBER));

  router.get("/", async (_req, res) => {
    res.json({ professionals: await listProfessionals(deps.db) });
  });

  return router;
}

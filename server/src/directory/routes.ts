import express from "express";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth/guards.js";
import { pageAfter } from "../paging.js";
import { Role } from "../roles.js";
import { professionalOr404 } from "./lookup.js";
import { professionalCursorValueSchema } from "./schemas.js";
import { listProfessionals } from "./store.js";

export function directoryRoutes(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(requireRole(deps, Role.MEMBER));

  router.get("/", async (req, res) => {
    res.json(await listProfessionals(deps.db, pageAfter(req.query, professionalCursorValueSchema)));
  });

  router.get("/:id", async (req, res) => {
    res.json({ professional: await professionalOr404(deps, req.params.id) });
  });

  return router;
}

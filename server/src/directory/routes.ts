import express from "express";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth/sign-in.js";
import { decodeCursor } from "../paging.js";
import { Role } from "../roles.js";
import { parseBody } from "../validation.js";
import { professionalOr404 } from "./lookup.js";
import { professionalCursorValue, professionalsPageSchema } from "./schemas.js";
import { listProfessionals } from "./store.js";

export function directoryRoutes(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(requireRole(deps, Role.MEMBER));

  router.get("/", async (req, res) => {
    const { cursor } = parseBody(professionalsPageSchema, req.query);
    const after = cursor === undefined ? undefined : decodeCursor(cursor, professionalCursorValue);
    res.json(await listProfessionals(deps.db, after));
  });

  router.get("/:id", async (req, res) => {
    res.json({ professional: await professionalOr404(deps, req.params.id) });
  });

  return router;
}

import express from "express";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth/session.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role } from "../roles.js";
import { professionalIdSchema } from "./schemas.js";
import { findProfessional, listProfessionals, type Professional } from "./store.js";

function notFound() {
  return new HttpError(404, ErrorCode.NOT_FOUND, "We couldn't find that professional.");
}

// A bad id, a missing id and a member's id all look the same, so none reveals whether an account exists.
// The id is checked before the query because Postgres throws on a malformed uuid.
async function professionalOr404(deps: AppDeps, id: unknown): Promise<Professional> {
  const parsed = professionalIdSchema.safeParse(id);
  if (!parsed.success) throw notFound();
  const professional = await findProfessional(deps.db, parsed.data);
  if (!professional) throw notFound();
  return professional;
}

export function directoryRoutes(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(requireRole(deps, Role.MEMBER));

  router.get("/", async (_req, res) => {
    res.json({ professionals: await listProfessionals(deps.db) });
  });

  router.get("/:id", async (req, res) => {
    res.json({ professional: await professionalOr404(deps, req.params.id) });
  });

  return router;
}

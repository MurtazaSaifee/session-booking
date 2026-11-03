import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, notSignedIn, requireRole } from "../auth/session.js";
import { Role } from "../roles.js";
import { parseBody } from "../validation.js";
import { profileChangesSchema } from "./schemas.js";
import { findProfile, updateProfile } from "./store.js";

export function settingsRoutes(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(requireRole(deps, Role.PROFESSIONAL));

  router.get("/profile", async (_req, res) => {
    const { id } = currentUser(res);
    const profile = await findProfile(deps.db, id);
    if (!profile) throw notSignedIn();

    res.json({ profile });
  });

  router.patch("/profile", async (req, res) => {
    const { id } = currentUser(res);
    const changes = parseBody(profileChangesSchema, req.body);
    const profile = await updateProfile(deps.db, id, changes);
    if (!profile) throw notSignedIn();

    res.json({ profile });
  });

  return router;
}

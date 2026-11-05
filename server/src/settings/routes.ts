import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, notSignedIn, requireRole } from "../auth/sign-in.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role } from "../roles.js";
import { parseBody } from "../validation.js";
import { findOverlappingDay, weekdayName } from "./hours.js";
import { hoursSchema, profileChangesSchema } from "./schemas.js";
import { findProfile, listHours, replaceHours, updateProfile } from "./store.js";

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

  router.get("/hours", async (_req, res) => {
    const { id } = currentUser(res);

    res.json({ ranges: await listHours(deps.db, id) });
  });

  router.put("/hours", async (req, res) => {
    const { id } = currentUser(res);
    const { ranges } = parseBody(hoursSchema, req.body);
    const overlappingDay = findOverlappingDay(ranges);
    if (overlappingDay !== null) {
      throw new HttpError(
        400,
        ErrorCode.RANGES_OVERLAP,
        `${weekdayName(overlappingDay)}'s time ranges overlap. Please fix them.`,
      );
    }
    const saved = await replaceHours(deps.db, id, ranges, deps.now());

    res.json({ ranges: saved });
  });

  return router;
}

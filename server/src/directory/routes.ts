import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireRole } from "../auth/session.js";
import { Role } from "../roles.js";
import { bookingWindowEnd, buildSlots } from "../slots/slots.js";
import { findSlotInputs } from "../slots/store.js";
import { parseProfessionalId, professionalNotFound, professionalOr404 } from "./lookup.js";
import { listProfessionals } from "./store.js";

export function directoryRoutes(deps: AppDeps): express.Router {
  const router = express.Router();
  router.use(requireRole(deps, Role.MEMBER));

  router.get("/", async (_req, res) => {
    res.json({ professionals: await listProfessionals(deps.db) });
  });

  router.get("/:id", async (req, res) => {
    res.json({ professional: await professionalOr404(deps, req.params.id) });
  });

  router.get("/:id/slots", async (req, res) => {
    const { id: memberId } = currentUser(res);
    const professionalId = parseProfessionalId(req.params.id);
    const now = deps.now();
    const inputs = await findSlotInputs(deps.db, { professionalId, memberId, now });
    if (!inputs) throw professionalNotFound();
    const { ranges, timezone, memberBusy, professionalBusy } = inputs;
    // Merged so the response can't reveal whether a slot is missing because of this member or someone else.
    const busy = [...memberBusy, ...professionalBusy];
    res.json({ slots: buildSlots({ ranges, timezone, now, windowEnd: bookingWindowEnd(now), busy }) });
  });

  return router;
}

import express from "express";
import type { AppDeps } from "../app.js";
import { requireRole } from "../auth/session.js";
import { Role } from "../roles.js";
import { listHours } from "../settings/store.js";
import { professionalOr404 } from "./lookup.js";
import { bookingWindowEnd, buildSlots } from "./slots.js";
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
    const professional = await professionalOr404(deps, req.params.id);
    const ranges = await listHours(deps.db, professional.id);
    const now = deps.now();
    const windowEnd = bookingWindowEnd(now);
    // Booked sessions will go in `busy` once they exist.
    res.json({ slots: buildSlots({ ranges, timezone: professional.timezone, now, windowEnd, busy: [] }) });
  });

  return router;
}

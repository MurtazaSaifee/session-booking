import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireRole } from "../auth/guards.js";
import { Role } from "../roles.js";
import { parseInput } from "../validation.js";
import { slotInputsOr404 } from "./lookup.js";
import { slotsQuerySchema } from "./schemas.js";
import { bookingWindowEnd, buildSlots } from "./slots.js";

export function slotRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.get("/:id/slots", requireRole(deps, Role.MEMBER), async (req, res) => {
    const { id: memberId } = currentUser(res);
    const { ignoreSessionId } = parseInput(slotsQuerySchema, req.query);
    const now = deps.now();
    const { inputs } = await slotInputsOr404(deps, {
      professionalId: req.params.id,
      memberId,
      now,
      ignoreSessionId,
    });
    const { memberBusy, professionalBusy, ignoredSessionStart, ...rules } = inputs;
    // Merged so the response can't reveal whether a slot is missing because of this member or someone else.
    const busy = [...memberBusy, ...professionalBusy];
    let slots = buildSlots({ ...rules, now, windowEnd: bookingWindowEnd(now), busy });
    if (ignoredSessionStart) {
      slots = slots.filter((slot) => slot.start.getTime() !== ignoredSessionStart.getTime());
    }
    res.json({ slots });
  });

  return router;
}

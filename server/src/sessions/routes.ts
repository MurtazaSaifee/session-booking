import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireRole } from "../auth/session.js";
import { parseProfessionalId, professionalNotFound } from "../directory/lookup.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role } from "../roles.js";
import { parseBody } from "../validation.js";
import { checkStart, sessionEnd, type BookingRefusal } from "./booking.js";
import { bookSessionSchema } from "./schemas.js";
import { findBookingContext, insertSession } from "./store.js";

const refusals: Record<BookingRefusal, { status: number; message: string }> = {
  [ErrorCode.SLOT_NOT_AVAILABLE]: { status: 422, message: "That time isn't available." },
  [ErrorCode.MEMBER_OVERLAP]: { status: 409, message: "You already have a session at that time." },
  [ErrorCode.SLOT_TAKEN]: { status: 409, message: "That time was just booked. Please pick another." },
};

function refuse(refusal: BookingRefusal): HttpError {
  return new HttpError(refusals[refusal].status, refusal, refusals[refusal].message);
}

export function sessionRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.post("/", requireRole(deps, Role.MEMBER), async (req, res) => {
    const { id: memberId } = currentUser(res);
    const body = parseBody(bookSessionSchema, req.body);
    const professionalId = parseProfessionalId(body.professionalId);
    const startsAt = new Date(body.start);
    const now = deps.now();

    const context = await findBookingContext(deps.db, { professionalId, memberId, now });
    if (!context) throw professionalNotFound();

    const refusal = checkStart({ start: startsAt, now, ...context });
    if (refusal) throw refuse(refusal);

    const saved = await insertSession(deps.db, {
      memberId,
      professionalId,
      start: startsAt,
      end: sessionEnd(startsAt),
    });

    if ("refusal" in saved) throw refuse(saved.refusal);

    res.status(201).json({ session: saved.session });
  });

  return router;
}

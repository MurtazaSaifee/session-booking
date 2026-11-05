import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireRole, requireSignedIn } from "../auth/sign-in.js";
import { decodeCursor } from "../paging.js";
import { Role } from "../roles.js";
import { slotInputsOr404 } from "../slots/lookup.js";
import { sessionEnd } from "../slots/slots.js";
import { parseBody } from "../validation.js";
import { checkStart, refuse } from "./booking.js";
import { listMySessions, listNextSessions } from "./list-store.js";
import { bookSessionSchema, sessionCursorValue, sessionsPageSchema } from "./schemas.js";
import { insertSession } from "./store.js";

export function sessionRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  // With no query, the first page of every list. Next on one list sends that list and its cursor.
  router.get("/", requireSignedIn(deps), async (req, res) => {
    const viewer = currentUser(res);
    const now = deps.now();
    if (Object.keys(req.query).length === 0) {
      res.json(await listMySessions(deps.db, viewer, now));
      return;
    }
    const { list, cursor } = parseBody(sessionsPageSchema, req.query);
    const after = decodeCursor(cursor, sessionCursorValue);
    res.json(await listNextSessions(deps.db, viewer, { list, after, now }));
  });

  router.post("/", requireRole(deps, Role.MEMBER), async (req, res) => {
    const { id: memberId } = currentUser(res);
    const body = parseBody(bookSessionSchema, req.body);
    const startsAt = new Date(body.start);
    const now = deps.now();

    const { professionalId, inputs } = await slotInputsOr404(deps, {
      professionalId: body.professionalId,
      memberId,
      now,
    });

    const refusal = checkStart({ start: startsAt, now, ...inputs });
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

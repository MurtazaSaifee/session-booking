import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireRole, requireSignedIn } from "../auth/guards.js";
import { decodeCursor, timeCursorValueSchema } from "../paging.js";
import { Role } from "../roles.js";
import { parseInput } from "../validation.js";
import { cancelMySession } from "./cancel.js";
import { mySessionOr404 } from "./lookup.js";
import { sessionsPageSchema } from "./schemas.js";
import { listMySessions, listNextSessions } from "./store.js";

export function sessionRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.get("/", requireSignedIn(deps), async (_req, res) => {
    res.json(await listMySessions(deps.db, currentUser(res), deps.now()));
  });

  router.get("/lists/:list", requireSignedIn(deps), async (req, res) => {
    const { list, cursor } = parseInput(sessionsPageSchema, {
      list: req.params.list,
      cursor: req.query.cursor,
    });
    const after = decodeCursor(cursor, timeCursorValueSchema);
    res.json(await listNextSessions(deps.db, currentUser(res), { list, after, now: deps.now() }));
  });

  router.get("/:id", requireSignedIn(deps), async (req, res) => {
    res.json({ session: await mySessionOr404(deps, currentUser(res), req.params.id) });
  });

  router.post("/:id/cancel", requireRole(deps, Role.PROFESSIONAL), async (req, res) => {
    await cancelMySession(deps, currentUser(res), req.params.id);
    res.status(204).end();
  });

  return router;
}

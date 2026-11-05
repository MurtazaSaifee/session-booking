import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireSignedIn } from "../auth/sign-in.js";
import { decodeCursor } from "../paging.js";
import { parseBody } from "../validation.js";
import { mySessionOr404 } from "./lookup.js";
import { sessionCursorValue, sessionsPageSchema } from "./schemas.js";
import { listMySessions, listNextSessions } from "./store.js";

export function sessionRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.get("/", requireSignedIn(deps), async (_req, res) => {
    res.json(await listMySessions(deps.db, currentUser(res), deps.now()));
  });

  router.get("/lists/:list", requireSignedIn(deps), async (req, res) => {
    const { list, cursor } = parseBody(sessionsPageSchema, {
      list: req.params.list,
      cursor: req.query.cursor,
    });
    const after = decodeCursor(cursor, sessionCursorValue);
    res.json(await listNextSessions(deps.db, currentUser(res), { list, after, now: deps.now() }));
  });

  router.get("/:id", requireSignedIn(deps), async (req, res) => {
    res.json({ session: await mySessionOr404(deps, currentUser(res), req.params.id) });
  });

  return router;
}

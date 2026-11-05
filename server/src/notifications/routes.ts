import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireSignedIn } from "../auth/guards.js";
import { decodeCursor, timeCursorValueSchema } from "../paging.js";
import { parseInput } from "../validation.js";
import { notificationsPageSchema } from "./schemas.js";
import { listMyNotifications, markAllRead } from "./store.js";

export function notificationRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.get("/", requireSignedIn(deps), async (req, res) => {
    const { cursor } = parseInput(notificationsPageSchema, req.query);
    const after = cursor === undefined ? undefined : decodeCursor(cursor, timeCursorValueSchema);
    res.json(await listMyNotifications(deps.db, currentUser(res).id, after));
  });

  router.post("/read", requireSignedIn(deps), async (_req, res) => {
    await markAllRead(deps.db, currentUser(res).id, deps.now());
    res.status(204).end();
  });

  return router;
}

import express from "express";
import type { AppDeps } from "../app.js";
import { currentUser, requireSignedIn } from "../auth/guards.js";
import { pageAfter, timeCursorValueSchema } from "../paging.js";
import { countUnread, listMyNotifications, markAllRead } from "./store.js";

export function notificationRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.get("/", requireSignedIn(deps), async (req, res) => {
    const after = pageAfter(req.query, timeCursorValueSchema);
    res.json(await listMyNotifications(deps.db, currentUser(res).id, after));
  });

  router.get("/unread-count", requireSignedIn(deps), async (_req, res) => {
    res.json({ unreadCount: await countUnread(deps.db, currentUser(res).id) });
  });

  router.post("/read", requireSignedIn(deps), async (_req, res) => {
    await markAllRead(deps.db, currentUser(res).id, deps.now());
    res.status(204).end();
  });

  return router;
}

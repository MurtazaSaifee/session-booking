import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { parseCheckIntervalMs, startBackgroundChecks } from "./background-checks.js";
import { dbFromEnv } from "./db.js";
import { prepareDatabase } from "./prepare-database.js";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is not set");

// On Lambda a new copy can start for any request and freezes between them, so copies only answer requests.
// Migrations and the background checks run as their own functions there.
const apiOnly = process.env.API_ONLY === "true";

const port = Number(process.env.PORT ?? 3000);
const checkIntervalMs = parseCheckIntervalMs(process.env.BACKGROUND_CHECK_SECONDS);
const db = dbFromEnv(process.env);
const now = () => new Date();
if (!apiOnly) await prepareDatabase(db, now(), process.env);

const defaultStaticDir = fileURLToPath(new URL("../../web/dist", import.meta.url));
const staticDir = process.env.STATIC_DIR ?? (existsSync(defaultStaticDir) ? defaultStaticDir : undefined);
const secureCookies =
  process.env.SECURE_COOKIES === "true" ||
  (process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES !== "false");

const app = createApp({
  db,
  now,
  jwtSecret,
  secureCookies,
  staticDir,
});

app.listen(port, (err) => {
  if (err) throw err;
  console.log(`API listening on http://localhost:${port}`);
  if (!apiOnly) startBackgroundChecks({ db, now }, checkIntervalMs);
});

import { createApp } from "./app.js";
import { createDb } from "./db.js";
import { migrate } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is not set");

const port = Number(process.env.PORT ?? 3000);
const db = createDb(databaseUrl);
const applied = await migrate(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);
const app = createApp({
  db,
  now: () => new Date(),
  jwtSecret,
  secureCookies: process.env.NODE_ENV === "production",
});

app.listen(port, (err) => {
  if (err) throw err;
  console.log(`API listening on http://localhost:${port}`);
});

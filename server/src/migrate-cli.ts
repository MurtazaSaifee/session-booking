import { createDb } from "./db.js";
import { migrate, rollback } from "./migrate.js";

const command = process.argv[2];
if (command !== "latest" && command !== "rollback") {
  throw new Error("Usage: tsx src/migrate-cli.ts latest|rollback");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const db = createDb(databaseUrl);
try {
  const ran = command === "latest" ? await migrate(db) : await rollback(db);
  console.log(ran.length ? `${command}: ${ran.join(", ")}` : `${command}: nothing to run`);
} finally {
  await db.destroy();
}

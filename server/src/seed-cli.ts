import { createDb } from "./db.js";
import { seedIfEmpty } from "./seed.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const db = createDb(databaseUrl);
try {
  const seeded = await seedIfEmpty(db, new Date());
  console.log(seeded ? "Seeded demo data." : "Database not empty; skipping.");
} finally {
  await db.destroy();
}

import type { Db } from "./db.js";
import { migrate } from "./migrate.js";
import { seedIfEmpty, shouldSeedDemoData } from "./seed.js";

export async function prepareDatabase(
  db: Db,
  now: Date,
  env: { NODE_ENV?: string; SEED_DEMO_DATA?: string },
): Promise<void> {
  const applied = await migrate(db);
  if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);
  if (shouldSeedDemoData(env)) {
    const seeded = await seedIfEmpty(db, now);
    if (seeded) console.log("Seeded demo data");
  }
}

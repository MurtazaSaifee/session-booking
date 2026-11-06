import { dbFromEnv } from "../db.js";
import { prepareDatabase } from "../prepare-database.js";

const db = dbFromEnv(process.env);

// Runs once per deploy. A failure here throws, so the deploy fails rather than leaving the API on an old schema.
export async function handler(): Promise<void> {
  await prepareDatabase(db, new Date(), process.env);
}

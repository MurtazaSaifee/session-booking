import { dbFromEnv } from "../db.js";
import { resetDemoDatabase } from "../seed.js";

const db = dbFromEnv(process.env);

// Scheduled daily in the live demo so shared accounts and the upcoming demo session stay fresh.
export async function handler(): Promise<void> {
  await resetDemoDatabase(db, new Date(), process.env);
}

import { runBackgroundChecks } from "../background-checks.js";
import { dbFromEnv } from "../db.js";

const db = dbFromEnv(process.env);

// Runs on a schedule, in place of the loop the API runs everywhere else.
export async function handler(): Promise<void> {
  await runBackgroundChecks({ db, now: () => new Date() });
}

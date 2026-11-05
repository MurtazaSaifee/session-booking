import type { AppDeps } from "../app.js";
import { deliverDueReminders } from "./deliver.js";

const DEFAULT_CHECK_SECONDS = 60;

export function parseCheckIntervalMs(seconds: string | undefined): number {
  if (seconds === undefined) return DEFAULT_CHECK_SECONDS * 1000;
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("REMINDER_CHECK_SECONDS must be a positive number");
  }
  return parsed * 1000;
}

// Runs once now, so reminders that came due while the server was down go out at start-up, then on a timer.
// A slow run can overlap the next one safely, because checkers skip each other's rows. A failed run is logged,
// and the next one tries again.
export function startReminderChecker(deps: Pick<AppDeps, "db" | "now">, intervalMs: number): NodeJS.Timeout {
  const check = () => {
    deliverDueReminders(deps.db, deps.now()).catch((err: unknown) => {
      console.error("Reminder check failed", err);
    });
  };
  check();
  return setInterval(check, intervalMs);
}

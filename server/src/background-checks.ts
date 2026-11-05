import type { AppDeps } from "./app.js";
import { deleteDeadRefreshTokens } from "./auth/refresh-token-store.js";
import { deliverDueReminders } from "./reminders/deliver.js";

const DEFAULT_CHECK_SECONDS = 60;

export function parseCheckIntervalMs(seconds: string | undefined): number {
  if (seconds === undefined) return DEFAULT_CHECK_SECONDS * 1000;
  const parsed = Number(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("BACKGROUND_CHECK_SECONDS must be a positive number");
  }
  return parsed * 1000;
}

// Delivers due reminders and cleans up dead refresh tokens: once now, so reminders that came due while the server
// was down go out at start-up, then on a timer. A slow run can overlap the next one safely, because checkers skip
// each other's rows. A failed run is logged and the next one tries again. The two jobs share the loop but not their
// failures, so one can't stop the other.
export function startBackgroundChecks(deps: Pick<AppDeps, "db" | "now">, intervalMs: number): NodeJS.Timeout {
  const check = () => {
    const now = deps.now();
    deliverDueReminders(deps.db, now).catch((err: unknown) => {
      console.error("Reminder check failed", err);
    });
    deleteDeadRefreshTokens(deps.db, now).catch((err: unknown) => {
      console.error("Refresh token clean-up failed", err);
    });
  };
  check();
  return setInterval(check, intervalMs);
}

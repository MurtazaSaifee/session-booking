import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { runBackgroundChecks, startBackgroundChecks } from "../src/background-checks.js";
import { createTestApp, resetDb, testClock } from "./app.js";
import { CLOCK_START } from "./booking/helpers.js";
import { createTestDb } from "./db.js";
import { DAY_BEFORE_DUE, bookOneSession, textsFor } from "./reminders/helpers.js";

const HOUR_MS = 60 * 60 * 1000;
const SOON_MS = 10;

// The checker gets its own clock: moving the app's a week on would expire the sign-ins the tests read with.
const appClock = testClock(CLOCK_START);
const checkerClock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, appClock.now);

let checker: NodeJS.Timeout | undefined;

beforeEach(() => {
  checkerClock.set(CLOCK_START);
  return resetDb(db);
});

afterEach(() => {
  clearInterval(checker);
  vi.restoreAllMocks();
});

afterAll(() => db.destroy());

it("checks once at start-up, without waiting for the first interval", async () => {
  const { member } = await bookOneSession(app);
  checkerClock.set(DAY_BEFORE_DUE);

  checker = startBackgroundChecks({ db, now: checkerClock.now }, HOUR_MS);

  await vi.waitFor(async () => expect(await textsFor(member)).toHaveLength(1));
});

it("keeps checking on the interval, at the time it is then", async () => {
  const { member } = await bookOneSession(app);

  checker = startBackgroundChecks({ db, now: checkerClock.now }, SOON_MS);
  expect(await textsFor(member)).toEqual([]);
  checkerClock.set(DAY_BEFORE_DUE);

  await vi.waitFor(async () => expect(await textsFor(member)).toHaveLength(1));
});

it("logs a failed check and keeps going", async () => {
  const brokenDb = createTestDb();
  await brokenDb.destroy();
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  checker = startBackgroundChecks({ db: brokenDb, now: checkerClock.now }, SOON_MS);

  await vi.waitFor(() => {
    const reminderFailures = logged.mock.calls.filter(([message]) => message === "Reminder check failed");
    expect(reminderFailures.length).toBeGreaterThanOrEqual(2);
  });
});

it("one run delivers what's due and finishes, with no loop left behind", async () => {
  const { member } = await bookOneSession(app);
  await db("refresh_tokens").update({ revoked_at: new Date(CLOCK_START) });
  checkerClock.set(DAY_BEFORE_DUE);

  await runBackgroundChecks({ db, now: checkerClock.now });

  expect(await textsFor(member)).toHaveLength(1);
  expect(await db("refresh_tokens").select("id")).toEqual([]);
});

it("one run logs a failure rather than throwing", async () => {
  const brokenDb = createTestDb();
  await brokenDb.destroy();
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(runBackgroundChecks({ db: brokenDb, now: checkerClock.now })).resolves.toBeUndefined();

  const messages = logged.mock.calls.map(([message]) => message);
  expect(messages).toContain("Reminder check failed");
  expect(messages).toContain("Refresh token clean-up failed");
});

it("the same loop cleans up dead refresh tokens", async () => {
  await bookOneSession(app);
  await db("refresh_tokens").update({ revoked_at: new Date(CLOCK_START) });

  checker = startBackgroundChecks({ db, now: checkerClock.now }, HOUR_MS);

  await vi.waitFor(async () => expect(await db("refresh_tokens").select("id")).toEqual([]));
});

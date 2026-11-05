import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { parseCheckIntervalMs, startReminderChecker } from "../../src/reminders/checker.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { DAY_BEFORE_DUE, HOUR_BEFORE_DUE, bookOneSession, textsFor } from "./helpers.js";

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

  checker = startReminderChecker({ db, now: checkerClock.now }, HOUR_MS);

  await vi.waitFor(async () => expect(await textsFor(member)).toHaveLength(1));
});

it("keeps checking on the interval, at the time it is then", async () => {
  const { member } = await bookOneSession(app);

  checker = startReminderChecker({ db, now: checkerClock.now }, SOON_MS);
  expect(await textsFor(member)).toEqual([]);
  checkerClock.set(DAY_BEFORE_DUE);

  await vi.waitFor(async () => expect(await textsFor(member)).toHaveLength(1));
});

it("logs a failed check and keeps going", async () => {
  await bookOneSession(app);
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
  await db("reminders").update({ status: ReminderStatus.PENDING });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  checkerClock.set(HOUR_BEFORE_DUE);

  checker = startReminderChecker({ db, now: checkerClock.now }, SOON_MS);

  await vi.waitFor(() => expect(logged.mock.calls.length).toBeGreaterThanOrEqual(2));
  expect(logged).toHaveBeenCalledWith("Reminder check failed", expect.anything());
});

it("checks every 60 seconds unless the setting says otherwise", () => {
  expect(parseCheckIntervalMs(undefined)).toBe(60_000);
  expect(parseCheckIntervalMs("5")).toBe(5_000);
});

it.each(["", "0", "-1", "soon"])("refuses a check interval of %j", (seconds) => {
  expect(() => parseCheckIntervalMs(seconds)).toThrow("REMINDER_CHECK_SECONDS");
});

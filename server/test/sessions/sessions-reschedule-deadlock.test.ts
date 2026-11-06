import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, KOLKATA_SECOND, SESSIONS_URL } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { bookOneSession, textsFor } from "../reminders/helpers.js";
import { reschedule } from "./helpers.js";

const db = createTestDb();
const app = createTestApp(db, testClock(CLOCK_START).now);

const deadlock = Object.assign(new Error("deadlock detected"), { code: "40P01" });

beforeEach(() => resetDb(db));

afterEach(() => vi.restoreAllMocks());

afterAll(() => db.destroy());

// Only the statement that saves the move fails, so the reads before it still work.
function deadlockTheMove(times: number) {
  const original = db.raw.bind(db);
  let left = times;
  vi.spyOn(db, "raw").mockImplementation(((sql: unknown, ...rest: unknown[]) => {
    if (left > 0 && String(sql).includes("dropped_reminders")) {
      left--;
      return Promise.reject(deadlock);
    }
    return (original as (...args: unknown[]) => unknown)(sql, ...rest);
  }) as never);
}

it("a move that Postgres cancels as a deadlock is run again and goes through", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  deadlockTheMove(1);

  const res = await reschedule(member, sessionId, KOLKATA_SECOND);

  expect(res.status).toBe(204);
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { id: sessionId, start: "2027-01-18T04:30:00.000Z" },
  ]);
  expect(await textsFor(professional)).toHaveLength(1);
});

it("gives up after a second deadlock and leaves the session where it was", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  deadlockTheMove(2);
  vi.spyOn(console, "error").mockImplementation(() => {});

  const res = await reschedule(member, sessionId, KOLKATA_SECOND);

  expect(res.status).toBe(500);
  expect(res.body.error).toBe(ErrorCode.INTERNAL);
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { start: "2027-01-18T03:30:00.000Z" },
  ]);
  expect(await textsFor(professional)).toEqual([]);
});

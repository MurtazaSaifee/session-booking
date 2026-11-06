import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { CancelledBy } from "../../src/sessions/my-session.js";
import { createTestApp, resetDb, testClock, testMember, testProfessional } from "../app.js";
import { CLOCK_START, SESSIONS_URL, logIn } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import {
  DAY_BEFORE_DUE,
  HOUR_BEFORE_DUE,
  PROFESSIONAL_READS,
  bookOneSession,
  textsFor,
} from "../reminders/helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

const TOO_LATE =
  "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.";
const ALREADY_ENDED = "This session has already ended, so it can't be cancelled or rescheduled.";
const SESSION_END = "2027-01-18T04:20:00Z";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

// The jump in time also expires the sign-ins, so both log in again at the new time.
async function memberCancelsAt(time: string | number) {
  const booked = await bookOneSession(app);
  clock.set(new Date(time).toISOString());
  await logIn(booked.member, testMember);
  await logIn(booked.professional, testProfessional);
  const res = await booked.member.post(`${SESSIONS_URL}/${booked.sessionId}/cancel`).send({});
  return { ...booked, res };
}

it("a member can cancel at exactly 24 hours before the start", async () => {
  const { res, member, professional } = await memberCancelsAt(DAY_BEFORE_DUE);

  expect(res.status).toBe(204);
  const list = (await member.get(SESSIONS_URL)).body;
  expect(list.cancelled.items).toMatchObject([{ cancelledBy: CancelledBy.YOU }]);
  expect(await textsFor(professional)).toEqual(["Theo Marsh cancelled your session on Mon 18 Jan at 9:00am"]);
});

it("one millisecond later it is refused with the 24-hour message and the session stays booked", async () => {
  const { res, member, professional } = await memberCancelsAt(new Date(DAY_BEFORE_DUE).getTime() + 1);

  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: ErrorCode.TOO_LATE_TO_CHANGE, message: TOO_LATE });
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toHaveLength(1);
  expect(await textsFor(professional)).toEqual([]);
});

it.each([
  ["inside the last hour", "2027-01-18T03:00:00Z"],
  ["after it started", "2027-01-18T03:40:00Z"],
])("a member is refused %s too", async (_name, time) => {
  const { res } = await memberCancelsAt(time);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.TOO_LATE_TO_CHANGE);
});

it("once the session has ended, the refusal says so instead of calling it still booked", async () => {
  const { res } = await memberCancelsAt(SESSION_END);

  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: ErrorCode.TOO_LATE_TO_CHANGE, message: ALREADY_ENDED });
});

it("the professional's reminders for a session the member cancelled are never delivered", async () => {
  const { professional, member } = await memberCancelsAt(DAY_BEFORE_DUE);

  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  expect(await textsFor(professional)).not.toContain(PROFESSIONAL_READS);
  expect(await textsFor(professional)).toHaveLength(1);
  expect(await textsFor(member)).toEqual([]);
});

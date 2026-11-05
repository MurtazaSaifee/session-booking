import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { createTestApp, resetDb, testClock, testMember, testProfessional, signUpAgent } from "../app.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_SECOND,
  SESSIONS_URL,
  SINGAPORE_SLOT,
  book,
  logIn,
  signUpProfessional,
  singaporeProfessional,
} from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { DAY_BEFORE_DUE, bookOneSession, textsFor } from "../reminders/helpers.js";
import { reschedule } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

const TOO_LATE =
  "This session starts in less than 24 hours, so it can't be cancelled or rescheduled. It's still booked.";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

async function startsOf(member: Awaited<ReturnType<typeof bookOneSession>>["member"]) {
  const { upcoming } = (await member.get(SESSIONS_URL)).body;
  return upcoming.items.map((session: { start: string }) => session.start);
}

// The jump in time also expires the sign-in, so the member logs in again at the new time.
async function memberReschedulesAt(time: string | number) {
  const booked = await bookOneSession(app);
  clock.set(new Date(time).toISOString());
  await logIn(booked.member, testMember);
  await logIn(booked.professional, testProfessional);
  const res = await reschedule(booked.member, booked.sessionId, KOLKATA_SECOND);
  return { ...booked, res };
}

it("a member can move a session at exactly 24 hours before the current start", async () => {
  const { res, member, professional } = await memberReschedulesAt(DAY_BEFORE_DUE);

  expect(res.status).toBe(204);
  expect(await startsOf(member)).toEqual(["2027-01-18T04:30:00.000Z"]);
  expect(await textsFor(professional)).toHaveLength(1);
});

it("one millisecond later the server refuses with the 24-hour message and nothing moves", async () => {
  const { res, member, professional } = await memberReschedulesAt(new Date(DAY_BEFORE_DUE).getTime() + 1);

  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: ErrorCode.TOO_LATE_TO_CHANGE, message: TOO_LATE });
  expect(await startsOf(member)).toEqual([KOLKATA_FIRST.replace("Z", ".000Z")]);
  expect(await textsFor(professional)).toEqual([]);
});

it.each([
  ["inside the last hour", "2027-01-18T03:00:00Z"],
  ["after it started", "2027-01-18T03:40:00Z"],
])("a member is refused %s too", async (_name, time) => {
  const { res } = await memberReschedulesAt(time);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.TOO_LATE_TO_CHANGE);
});

// The new start follows the booking rules. Nora is free on Mondays 09:00-12:00 Kolkata time.
it.each([
  ["off the hourly grid", "2027-01-18T04:00:00Z"],
  ["outside her hours", "2027-01-18T07:30:00Z"],
  ["already past", "2027-01-11T03:30:00Z"],
  ["beyond the next 4 weeks", "2027-02-15T03:30:00Z"],
])("refuses a new time that is %s and leaves the session where it was", async (_name, start) => {
  const { member, professional, sessionId } = await bookOneSession(app);

  const res = await reschedule(member, sessionId, start);

  expect(res.status).toBe(422);
  expect(res.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);
  expect(await startsOf(member)).toEqual(["2027-01-18T03:30:00.000Z"]);
  expect(await textsFor(professional)).toEqual([]);
});

it("refuses a new time that clashes with another of the member's sessions", async () => {
  const nora = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const owen = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const theo = await signUpAgent(app, testMember);
  const first = await book(theo, nora.id, KOLKATA_FIRST);
  await book(theo, owen.id, SINGAPORE_SLOT);

  // Nora's 10:00 slot (04:30Z) runs into the session with Owen at 05:00Z.
  const res = await reschedule(theo, first.body.session.id, KOLKATA_SECOND);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
  expect(await startsOf(theo)).toEqual(["2027-01-18T03:30:00.000Z", "2027-01-18T05:00:00.000Z"]);
});

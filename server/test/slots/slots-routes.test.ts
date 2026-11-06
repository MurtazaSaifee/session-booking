import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { SessionStatus } from "../../src/session-status.js";
import { SESSION_MINUTES } from "../../src/slots/slots.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
  type Agent,
} from "../booking/helpers.js";

const MONDAY = 1;
const CLOCK_START = "2027-01-15T09:00:00Z";
// A Monday morning in Kolkata, so the following Monday is the first full week of slots.
const BOOKING_CLOCK = "2027-01-11T04:00:00Z";

// Next Monday's slots with the Kolkata professional's 09:00-12:00 hours.
const NEXT_MONDAY = "2027-01-18";
const KOLKATA_FIRST = "2027-01-18T03:30:00.000Z";
const KOLKATA_SECOND = "2027-01-18T04:30:00.000Z";
const KOLKATA_THIRD = "2027-01-18T05:30:00.000Z";
// The Singapore professional's 13:00-14:00 hours overlap the Kolkata second and third slots.
const SINGAPORE_SLOT = "2027-01-18T05:00:00.000Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

// Only next Monday's slots, so the later weeks don't make the expectations long.
async function nextMondayStarts(member: Agent, professionalId: string): Promise<string[]> {
  const res = await member.get(`${API_V1}/professionals/${professionalId}/slots`);
  return res.body.slots
    .map((slot: { start: string }) => slot.start)
    .filter((start: string) => start.startsWith(NEXT_MONDAY));
}

it("a member sees a professional's free slots for the next 28 days, as start and end only", async () => {
  // 04:00Z is 09:30 in Kolkata, so today's 09:00 slot has passed and its 10:00 slot is inside the 2-hour notice.
  clock.set("2027-01-11T04:00:00Z");
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  await professional
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "11:00" }] });
  const member = await signUpAgent(app, testMember);
  const starts = [
    "2027-01-18T03:30:00Z",
    "2027-01-18T04:30:00Z",
    "2027-01-25T03:30:00Z",
    "2027-01-25T04:30:00Z",
    "2027-02-01T03:30:00Z",
    "2027-02-01T04:30:00Z",
    // The 04:30Z slot on 8 February would start after the window ends at 04:00Z.
    "2027-02-08T03:30:00Z",
  ];

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    slots: starts.map((start) => ({
      start: new Date(start).toISOString(),
      end: new Date(new Date(start).getTime() + SESSION_MINUTES * 60_000).toISOString(),
    })),
  });
});

it("a professional with no working hours has no slots", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ slots: [] });
});

it("a booked slot disappears for the member who booked it and for another member", async () => {
  clock.set(BOOKING_CLOCK);
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  await book(member, id, KOLKATA_FIRST);

  expect(await nextMondayStarts(member, id)).toEqual([KOLKATA_SECOND, KOLKATA_THIRD]);
  expect(await nextMondayStarts(iris, id)).toEqual([KOLKATA_SECOND, KOLKATA_THIRD]);
});

it("a member's own session hides another professional's overlapping slots", async () => {
  clock.set(BOOKING_CLOCK);
  const kolkata = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const singapore = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const member = await signUpAgent(app, testMember);
  await book(member, singapore.id, SINGAPORE_SLOT);

  // The 05:00Z session runs until 05:50Z, so it also covers the start of the 05:30Z slot.
  expect(await nextMondayStarts(member, kolkata.id)).toEqual([KOLKATA_FIRST]);
});

it("another member's session does not hide a different professional's slots", async () => {
  clock.set(BOOKING_CLOCK);
  const kolkata = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const singapore = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const member = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  await book(member, singapore.id, SINGAPORE_SLOT);

  expect(await nextMondayStarts(iris, kolkata.id)).toEqual([KOLKATA_FIRST, KOLKATA_SECOND, KOLKATA_THIRD]);
});

it("a slot that starts exactly when the member's session ends stays", async () => {
  clock.set(BOOKING_CLOCK);
  // 11:20 in Kolkata is 05:50Z, the moment the 05:00Z session with the Singapore professional ends.
  const kolkata = await signUpProfessional(app, testProfessional, "11:20", "12:10");
  const singapore = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const member = await signUpAgent(app, testMember);
  await book(member, singapore.id, SINGAPORE_SLOT);

  expect(await nextMondayStarts(member, kolkata.id)).toEqual(["2027-01-18T05:50:00.000Z"]);
});

it("a time freed by a cancelled session comes back", async () => {
  clock.set(BOOKING_CLOCK);
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  await book(member, id, KOLKATA_FIRST);
  await db("sessions").update({ status: SessionStatus.CANCELLED });

  expect(await nextMondayStarts(member, id)).toEqual([KOLKATA_FIRST, KOLKATA_SECOND, KOLKATA_THIRD]);
});

it.each([
  { case: "an unknown id", id: "00000000-0000-4000-8000-000000000000" },
  { case: "a malformed id", id: "not-a-uuid" },
])("a slots request with $case returns 404", async ({ id }) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

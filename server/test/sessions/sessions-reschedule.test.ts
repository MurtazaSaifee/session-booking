import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, KOLKATA_FIRST, KOLKATA_SECOND, SESSIONS_URL } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { bookOneSession, textsFor } from "../reminders/helpers.js";
import { reschedule } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

// The old 24-hour reminders were due at 03:30 on the 17th; the new ones fall due an hour later.
const BETWEEN_OLD_AND_NEW_DUE = "2027-01-17T04:00:00Z";
const NEW_HOUR_BEFORE_DUE = "2027-01-18T03:30:00Z";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

it("moves the same session to the new time, so the member still has exactly one", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  const res = await reschedule(member, sessionId, KOLKATA_SECOND);

  expect(res.status).toBe(204);
  const { upcoming, cancelled } = (await member.get(SESSIONS_URL)).body;
  expect(upcoming.items).toMatchObject([{ id: sessionId, start: "2027-01-18T04:30:00.000Z" }]);
  expect(cancelled.items).toEqual([]);
  const schedule = (await professional.get(SESSIONS_URL)).body;
  expect(schedule.upcoming.items).toMatchObject([{ id: sessionId, start: "2027-01-18T04:30:00.000Z" }]);
});

it("tells the professional the old and new times on their own clock", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  await reschedule(member, sessionId, KOLKATA_SECOND);

  expect(await textsFor(professional)).toEqual([
    "Theo Marsh moved your session from Mon 18 Jan at 9:00am to Mon 18 Jan at 10:00am",
  ]);
});

it("replaces the reminders: none for the old time, both people reminded for the new one", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await reschedule(member, sessionId, KOLKATA_SECOND);

  await deliverDueReminders(db, new Date(BETWEEN_OLD_AND_NEW_DUE));
  expect(await textsFor(member)).toEqual([]);
  expect(await textsFor(professional)).toHaveLength(1);

  await deliverDueReminders(db, new Date(NEW_HOUR_BEFORE_DUE));
  const memberTexts = await textsFor(member);
  expect(memberTexts).toEqual(Array(2).fill("Your session with Nora Quill is on Mon 18 Jan at 12:30pm"));
  expect(await textsFor(professional)).toHaveLength(3);
});

it("refuses a move to the time the session already has, and sends no notice", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  const res = await reschedule(member, sessionId, KOLKATA_FIRST);

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
  expect(await textsFor(professional)).toEqual([]);
});

it("does not count the session itself as busy when the professional's new hours put a slot across it", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  // The session is 09:00-09:50 in Kolkata. Hours starting at 09:30 leave it alone but offer 09:30-10:20.
  await professional
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: 1, start: "09:30", end: "12:30" }] });

  const res = await reschedule(member, sessionId, "2027-01-18T04:00:00Z");

  expect(res.status).toBe(204);
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { id: sessionId, start: "2027-01-18T04:00:00.000Z" },
  ]);
});

it("a session the professional cancelled can't be moved: it looks like one that isn't there", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await professional.post(`${SESSIONS_URL}/${sessionId}/cancel`).send({});

  const res = await reschedule(member, sessionId, KOLKATA_SECOND);

  expect(res.status).toBe(404);
  const { upcoming, cancelled } = (await member.get(SESSIONS_URL)).body;
  expect(upcoming.items).toEqual([]);
  expect(cancelled.items).toMatchObject([{ id: sessionId, start: "2027-01-18T03:30:00.000Z" }]);
});

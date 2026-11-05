import { afterAll, beforeEach, expect, it } from "vitest";
import { ReminderKind, ReminderStatus } from "../../src/reminders/reminder-values.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  book,
  otherMember,
  signUpProfessional,
  userId,
} from "../booking/helpers.js";
import { createTestDb } from "../db.js";

const HOUR = 60 * 60 * 1000;

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function dueBefore(start: string, hours: number) {
  return new Date(new Date(start).getTime() - hours * HOUR);
}

async function bookAt(now: string) {
  clock.set(now);
  const { id: professionalId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  const res = await book(member, professionalId, KOLKATA_FIRST);
  expect(res.status).toBe(201);
  return { professionalId, memberId: await userId(member), sessionId: res.body.session.id as string };
}

function remindersFor(sessionId: string) {
  return db("reminders")
    .where({ session_id: sessionId })
    .select("recipient_id", "kind", "due_at", "status", "sent_at");
}

it("plans both reminders for both people", async () => {
  const { professionalId, memberId, sessionId } = await bookAt(CLOCK_START);

  const reminders = await remindersFor(sessionId);

  const planned = (recipient_id: string, kind: ReminderKind, hours: number) => ({
    recipient_id,
    kind,
    due_at: dueBefore(KOLKATA_FIRST, hours),
    status: ReminderStatus.PENDING,
    sent_at: null,
  });
  expect(reminders).toHaveLength(4);
  expect(reminders).toEqual(
    expect.arrayContaining([
      planned(memberId, ReminderKind.DAY_BEFORE, 24),
      planned(memberId, ReminderKind.HOUR_BEFORE, 1),
      planned(professionalId, ReminderKind.DAY_BEFORE, 24),
      planned(professionalId, ReminderKind.HOUR_BEFORE, 1),
    ]),
  );
});

it.each([
  { case: "a little over 24 hours before", now: "2027-01-17T03:29:59Z", count: 4 },
  { case: "exactly 24 hours before", now: "2027-01-17T03:30:00Z", count: 2 },
  { case: "inside 24 hours", now: "2027-01-17T04:00:00Z", count: 2 },
  { case: "exactly 1 hour before", now: "2027-01-18T02:30:00Z", count: 0 },
  { case: "inside 1 hour", now: "2027-01-18T03:00:00Z", count: 0 },
])("booked $case, only reminders still in the future are planned", async ({ now, count }) => {
  const { sessionId } = await bookAt(now);

  const reminders = await remindersFor(sessionId);

  expect(reminders).toHaveLength(count);
  for (const reminder of reminders) {
    expect(reminder.due_at.getTime()).toBeGreaterThan(new Date(now).getTime());
  }
});

it("a booking the database refuses leaves no reminders behind", async () => {
  const { professionalId, sessionId } = await bookAt(CLOCK_START);
  const second = await signUpAgent(app, otherMember);

  const res = await book(second, professionalId, KOLKATA_FIRST);

  expect(res.status).toBe(409);
  expect(await db("reminders").whereNot({ session_id: sessionId }).select("id")).toEqual([]);
});

import { afterAll, beforeEach, expect, it } from "vitest";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import {
  DAY_BEFORE_DUE,
  HOUR_BEFORE_DUE,
  MEMBER_READS,
  PROFESSIONAL_READS,
  SESSION_START,
  bookOneSession,
  textsFor,
} from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function deliverAt(iso: string) {
  return deliverDueReminders(db, new Date(iso));
}

// "Mark it sent" and "mark it skipped" are ticket boxes that no API shows, so these two tests read the table.
function reminderStatuses(sessionId: string) {
  return db("reminders").where({ session_id: sessionId }).select("status", "sent_at");
}

it("delivers both reminders to both people, each when it comes due", async () => {
  const { member, professional } = await bookOneSession(app);

  await deliverAt(DAY_BEFORE_DUE);
  expect(await textsFor(member)).toEqual([MEMBER_READS]);
  expect(await textsFor(professional)).toEqual([PROFESSIONAL_READS]);

  await deliverAt(HOUR_BEFORE_DUE);
  expect(await textsFor(member)).toEqual([MEMBER_READS, MEMBER_READS]);
  expect(await textsFor(professional)).toEqual([PROFESSIONAL_READS, PROFESSIONAL_READS]);
});

it("delivers nothing a moment before a reminder is due", async () => {
  const { member, professional } = await bookOneSession(app);

  await deliverAt("2027-01-17T03:29:59Z");

  expect(await textsFor(member)).toEqual([]);
  expect(await textsFor(professional)).toEqual([]);
});

it("marks a delivered reminder sent at the time passed in", async () => {
  const { sessionId } = await bookOneSession(app);

  await deliverAt(DAY_BEFORE_DUE);

  const statuses = await reminderStatuses(sessionId);
  const sent = statuses.filter((reminder) => reminder.status === ReminderStatus.SENT);
  expect(sent).toEqual([
    { status: ReminderStatus.SENT, sent_at: new Date(DAY_BEFORE_DUE) },
    { status: ReminderStatus.SENT, sent_at: new Date(DAY_BEFORE_DUE) },
  ]);
  expect(statuses.filter((reminder) => reminder.status === ReminderStatus.PENDING)).toHaveLength(2);
});

it("delivers late reminders if the session hasn't started", async () => {
  const { member } = await bookOneSession(app);

  await deliverAt("2027-01-18T03:29:59Z");

  expect(await textsFor(member)).toEqual([MEMBER_READS, MEMBER_READS]);
});

it.each([
  { case: "as the session starts", now: SESSION_START },
  { case: "after the session starts", now: "2027-01-18T03:30:01Z" },
])("skips reminders checked $case", async ({ now }) => {
  const { member, professional, sessionId } = await bookOneSession(app);

  await deliverAt(now);

  expect(await textsFor(member)).toEqual([]);
  expect(await textsFor(professional)).toEqual([]);
  expect(await reminderStatuses(sessionId)).toEqual(
    Array(4).fill({ status: ReminderStatus.SKIPPED, sent_at: null }),
  );
});

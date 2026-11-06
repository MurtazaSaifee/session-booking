import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../../src/db.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, SESSIONS_URL, type Agent } from "../booking/helpers.js";
import { testDatabaseUrl } from "../db.js";
import { HOUR_BEFORE_DUE, bookOneSession, textsFor } from "../reminders/helpers.js";
import { CANCEL_ON_SESSION, holdSave, startCancel, waitUntilStuck } from "./helpers.js";

// One connection each for the hold, the two sides of the race, and watching them wait.
const db = createDb(testDatabaseUrl, { max: 4 });
const app = createTestApp(db, testClock(CLOCK_START).now);

const CHECKER_SAVING = "delivered as";
const CANCEL_SAVING = "cancelled_reminders";
beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

async function remindersDelivered(agent: Agent) {
  return (await textsFor(agent)).filter((text) => text.startsWith("Your session with")).length;
}

type Booked = Awaited<ReturnType<typeof bookOneSession>>;

// Each person sees the cancel and what reached them. Only the reminder status is about storage itself.
async function expectOutcome(
  { member, professional, sessionId }: Booked,
  expected: { deliveredEach: number; reminderStatus: ReminderStatus },
) {
  const { cancelled } = (await member.get(SESSIONS_URL)).body;
  expect(cancelled.items.map((session: { id: string }) => session.id)).toEqual([sessionId]);
  expect(await remindersDelivered(member)).toBe(expected.deliveredEach);
  expect(await remindersDelivered(professional)).toBe(expected.deliveredEach);
  const statuses: string[] = await db("reminders").where({ session_id: sessionId }).pluck("status");
  expect(statuses).toEqual(Array(4).fill(expected.reminderStatus));
}

it("a cancel waits for a checker holding the reminders, then leaves the delivered ones alone", async () => {
  const booked = await bookOneSession(app);
  const { professional, sessionId } = booked;
  const checkerSaving = {
    table: "notifications",
    event: "insert",
    when: "new.reminder_id is not null",
    atRow: 1,
  };

  await holdSave(db, checkerSaving, async (release) => {
    const check = deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await waitUntilStuck(db, CHECKER_SAVING);
    const cancel = startCancel(professional, sessionId);
    await waitUntilStuck(db, CANCEL_SAVING);
    await release();
    await Promise.all([check, cancel]);
  });

  await expectOutcome(booked, { deliveredEach: 2, reminderStatus: ReminderStatus.SENT });
});

it("a checker that runs while a cancel holds the reminders delivers none of them", async () => {
  const booked = await bookOneSession(app);
  const { professional, sessionId } = booked;
  const cancelOnLastReminder = {
    table: "reminders",
    event: "update",
    when: `new.status = '${ReminderStatus.CANCELLED}'`,
    atRow: 4,
  };

  await holdSave(db, cancelOnLastReminder, async (release) => {
    const cancel = startCancel(professional, sessionId);
    await waitUntilStuck(db, CANCEL_SAVING);
    await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await release();
    await cancel;
  });
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  await expectOutcome(booked, { deliveredEach: 0, reminderStatus: ReminderStatus.CANCELLED });
});

it("a checker that runs before the cancel reaches the reminders delivers them, and the cancel leaves them", async () => {
  const booked = await bookOneSession(app);

  await holdSave(db, CANCEL_ON_SESSION, async (release) => {
    const cancel = startCancel(booked.professional, booked.sessionId);
    await waitUntilStuck(db, CANCEL_SAVING);
    await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await release();
    await cancel;
  });

  await expectOutcome(booked, { deliveredEach: 2, reminderStatus: ReminderStatus.SENT });
});

it("two cancels at the same moment both succeed and tell the other person once", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  let statuses: number[] = [];
  await holdSave(db, CANCEL_ON_SESSION, async (release) => {
    const first = startCancel(professional, sessionId);
    await waitUntilStuck(db, CANCEL_SAVING);
    const second = startCancel(professional, sessionId);
    await waitUntilStuck(db, CANCEL_SAVING, 2);
    await release();
    statuses = (await Promise.all([first, second])).map((res) => res.status);
  });

  expect(statuses).toEqual([204, 204]);
  expect(await textsFor(member)).toHaveLength(1);
});

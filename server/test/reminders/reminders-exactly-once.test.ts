import { afterAll, beforeEach, expect, it } from "vitest";
import { deliverBatch, deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { CLOCK_START, KOLKATA_STARTS, book, signUpProfessional, userId } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { HOUR_BEFORE_DUE, bookOneSession, textsFor } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

const ALL_FOUR_DUE = new Date(HOUR_BEFORE_DUE);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

async function deliveredCount() {
  const row = await db("notifications").count<{ count: string }>("* as count").first();
  return Number(row?.count);
}

it("two checkers at once deliver each reminder once", async () => {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  const mondayStarts = KOLKATA_STARTS.slice(0, 8);
  for (const start of mondayStarts) await book(member, professional.id, start);
  // Just before the first session: every 24-hour reminder is due, and the first session's 1-hour ones.
  const now = new Date("2027-01-18T03:29:59Z");

  await Promise.all([deliverDueReminders(db, now, 5), deliverDueReminders(db, now, 5)]);

  const eachPerson = mondayStarts.length + 1;
  expect(await textsFor(db, await userId(member))).toHaveLength(eachPerson);
  expect(await textsFor(db, professional.id)).toHaveLength(eachPerson);
});

it("a checker skips rows another checker holds instead of waiting for them", async () => {
  await bookOneSession(app);

  await db.transaction(async (holding) => {
    await deliverBatch(holding, ALL_FOUR_DUE, 1);

    // Waiting on the held row would never finish, because this transaction only ends after this line.
    await deliverDueReminders(db, ALL_FOUR_DUE);
    expect(await deliveredCount()).toBe(3);
  });

  expect(await deliveredCount()).toBe(4);
});

it("a run that dies partway through a batch leaves nothing, and the repeat delivers everything once", async () => {
  await bookOneSession(app);

  const dying = db.transaction(async (trx) => {
    await deliverBatch(trx, ALL_FOUR_DUE, 2);
    throw new Error("the server died");
  });
  await expect(dying).rejects.toThrow("the server died");
  expect(await deliveredCount()).toBe(0);

  await deliverDueReminders(db, ALL_FOUR_DUE);
  expect(await deliveredCount()).toBe(4);
});

it("a run that dies between batches keeps what it delivered, and the repeat delivers the rest once", async () => {
  await bookOneSession(app);

  await deliverBatch(db, ALL_FOUR_DUE, 1);
  expect(await deliveredCount()).toBe(1);

  await deliverDueReminders(db, ALL_FOUR_DUE);
  expect(await deliveredCount()).toBe(4);
});

it("running again after everything is delivered adds nothing", async () => {
  await bookOneSession(app);
  await deliverDueReminders(db, ALL_FOUR_DUE);

  await deliverDueReminders(db, ALL_FOUR_DUE);

  expect(await deliveredCount()).toBe(4);
});

it("if the claim logic ever let a sent reminder through, the unique reference stops the second delivery", async () => {
  await bookOneSession(app);
  await deliverDueReminders(db, ALL_FOUR_DUE);

  await db("reminders").update({ status: ReminderStatus.PENDING });

  await expect(deliverDueReminders(db, ALL_FOUR_DUE)).rejects.toMatchObject({
    constraint: "notifications_reminder_id_key",
  });
  expect(await deliveredCount()).toBe(4);
});

import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { DAY_BEFORE_DUE, HOUR_BEFORE_DUE, bookOneSession, textsFor } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

const ALL_FOUR_DUE = new Date(HOUR_BEFORE_DUE);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

it("if the claim logic ever let a sent reminder through, there's no second delivery and the others still go out", async () => {
  const people = await bookOneSession(app);
  await deliverDueReminders(db, new Date(DAY_BEFORE_DUE));
  await db("reminders").where({ status: ReminderStatus.SENT }).update({ status: ReminderStatus.PENDING });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  await deliverDueReminders(db, ALL_FOUR_DUE);

  expect(await textsFor(people.member)).toHaveLength(2);
  expect(await textsFor(people.professional)).toHaveLength(2);
  expect(logged).toHaveBeenCalledOnce();
  logged.mockRestore();
});

it("the database refuses a second notification for one reminder", async () => {
  await bookOneSession(app);
  await deliverDueReminders(db, ALL_FOUR_DUE);
  const { id: _id, ...sameAgain } = await db("notifications").first();

  await expect(db("notifications").insert(sameAgain)).rejects.toMatchObject({
    constraint: "notifications_reminder_id_key",
  });
});

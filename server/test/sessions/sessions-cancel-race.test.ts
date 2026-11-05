import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeEach, expect, it } from "vitest";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, SESSIONS_URL, type Agent } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { HOUR_BEFORE_DUE, bookOneSession } from "../reminders/helpers.js";

const clock = testClock(CLOCK_START);

// Each test needs a connection for the checker and one for the cancel.
const db = createTestDb();
const app = createTestApp(db, clock.now);

const HEAD_START_MS = 100;

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

// Holds back the checker's saving, so a cancel can arrive while the checker holds its reminders.
async function slowCheckerSaves(run: () => Promise<void>) {
  await db.raw(
    "create function slow_down() returns trigger language plpgsql as $$ begin perform pg_sleep(0.15); return new; end $$",
  );
  await db.raw(
    "create trigger slow_down before insert on notifications for each row execute function slow_down()",
  );
  try {
    await run();
  } finally {
    await db.raw("drop trigger slow_down on notifications");
    await db.raw("drop function slow_down()");
  }
}

// Holds the cancel on its last reminder row until the test says the checker may run. By then the cancel has
// locked all four reminders.
async function holdCancelOnLastReminder(run: (cancelHoldsAllRows: () => Promise<void>) => Promise<void>) {
  await db.raw("create sequence rows_locked");
  await db.raw(`
    create function hold_last() returns trigger language plpgsql as $$
    begin
      if nextval('rows_locked') = 4 then perform pg_sleep(0.5); end if;
      return new;
    end $$`);
  await db.raw(
    "create trigger hold_last before update on reminders for each row execute function hold_last()",
  );
  const lockedAll = async () => {
    for (let wait = 0; wait < 100; wait++) {
      const { rows } = await db.raw("select last_value, is_called from rows_locked");
      if (rows[0].is_called && Number(rows[0].last_value) === 4) return;
      await sleep(10);
    }
    throw new Error("The cancel never reached its last reminder.");
  };
  try {
    await run(lockedAll);
  } finally {
    await db.raw("drop trigger hold_last on reminders");
    await db.raw("drop function hold_last()");
    await db.raw("drop sequence rows_locked");
  }
}

// A supertest request only starts when something waits on it, so this starts it now.
function startCancel(professional: Agent, sessionId: string) {
  return Promise.resolve(professional.post(`${SESSIONS_URL}/${sessionId}/cancel`).send({}));
}

async function afterTheRace(sessionId: string) {
  const reminders: { id: string; status: string }[] = await db("reminders").where({ session_id: sessionId });
  const deliveredIds: string[] = await db("notifications").whereNotNull("reminder_id").pluck("reminder_id");
  const session = await db("sessions").where({ id: sessionId }).first();
  return { reminders, deliveredIds, session };
}

it("a checker that holds the reminders first delivers them, and the cancel then leaves nothing pending", async () => {
  const { professional, sessionId } = await bookOneSession(app);

  await slowCheckerSaves(async () => {
    const check = deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await sleep(HEAD_START_MS);
    const cancel = startCancel(professional, sessionId);
    await Promise.all([check, cancel]);
  });

  const { reminders, deliveredIds, session } = await afterTheRace(sessionId);
  expect(session.status).toBe(SessionStatus.CANCELLED);
  expect(deliveredIds).toHaveLength(4);
  expect(reminders.map((reminder) => reminder.status)).toEqual(Array(4).fill(ReminderStatus.SENT));
});

it("a checker that runs while a cancel holds the reminders delivers none of them", async () => {
  const { professional, sessionId } = await bookOneSession(app);

  await holdCancelOnLastReminder(async (cancelHoldsAllRows) => {
    const cancel = startCancel(professional, sessionId);
    await cancelHoldsAllRows();
    await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await cancel;
  });
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  const { reminders, deliveredIds, session } = await afterTheRace(sessionId);
  expect(session.status).toBe(SessionStatus.CANCELLED);
  expect(deliveredIds).toEqual([]);
  expect(reminders.map((reminder) => reminder.status)).toEqual(Array(4).fill(ReminderStatus.CANCELLED));
});

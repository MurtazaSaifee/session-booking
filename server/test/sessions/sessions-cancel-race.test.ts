import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../../src/db.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, SESSIONS_URL, type Agent } from "../booking/helpers.js";
import { testDatabaseUrl } from "../db.js";
import { HOUR_BEFORE_DUE, bookOneSession } from "../reminders/helpers.js";

const clock = testClock(CLOCK_START);

// One connection each for the hold, the two sides of the race, and watching them wait.
const db = createDb(testDatabaseUrl, { max: 4 });
const app = createTestApp(db, clock.now);

const HOLD_LOCK_ID = 808;
// Also run first, because a hold left by a killed run would stop every later test that saves that row.
const DROP_HOLD = "drop function if exists hold_save() cascade; drop sequence if exists held_rows";
const CHECKER_SAVING = "delivered as";
const CANCEL_SAVING = "cancelled_reminders";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

type Hold = { table: string; event: string; when: string; atRow: number };

// Stops a save on one row until the test releases it, so the order of a race is chosen, not hoped for.
async function holdSave(
  { table, event, when, atRow }: Hold,
  run: (release: () => Promise<void>) => Promise<void>,
) {
  await db.raw(DROP_HOLD);
  const holder = await db.transaction();
  await holder.raw("select pg_advisory_xact_lock(?)", [HOLD_LOCK_ID]);
  await db.raw("create sequence held_rows");
  await db.raw(`
    create function hold_save() returns trigger language plpgsql as $$
    begin
      if nextval('held_rows') = ${atRow} then perform pg_advisory_xact_lock(${HOLD_LOCK_ID}); end if;
      return new;
    end $$`);
  await db.raw(
    `create trigger hold_save before ${event} on ${table} for each row when (${when}) execute function hold_save()`,
  );
  try {
    await run(async () => {
      await holder.commit();
    });
  } finally {
    if (!holder.isCompleted()) await holder.rollback();
    await db.raw(DROP_HOLD);
  }
}

// Row locks and the hold both show here, so this proves a statement really is stuck rather than slow to start.
async function waitUntilStuck(statementPart: string, statements = 1) {
  for (let wait = 0; wait < 300; wait++) {
    const { rows } = await db.raw(
      `select count(*) as stuck from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock' and query like ?`,
      [`%${statementPart}%`],
    );
    if (Number(rows[0].stuck) === statements) return;
    await sleep(10);
  }
  throw new Error(`Never saw ${statements} of "${statementPart}" waiting on a lock.`);
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

it("a cancel waits for a checker holding the reminders, then leaves the delivered ones alone", async () => {
  const { professional, sessionId } = await bookOneSession(app);
  const checkerSaving = {
    table: "notifications",
    event: "insert",
    when: "new.reminder_id is not null",
    atRow: 1,
  };

  await holdSave(checkerSaving, async (release) => {
    const check = deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await waitUntilStuck(CHECKER_SAVING);
    const cancel = startCancel(professional, sessionId);
    await waitUntilStuck(CANCEL_SAVING);
    await release();
    await Promise.all([check, cancel]);
  });

  const { reminders, deliveredIds, session } = await afterTheRace(sessionId);
  expect(session.status).toBe(SessionStatus.CANCELLED);
  expect(deliveredIds).toHaveLength(4);
  expect(reminders.map((reminder) => reminder.status)).toEqual(Array(4).fill(ReminderStatus.SENT));
});

it("a checker that runs while a cancel holds the reminders delivers none of them", async () => {
  const { professional, sessionId } = await bookOneSession(app);
  const cancelOnLastReminder = {
    table: "reminders",
    event: "update",
    when: `new.status = '${ReminderStatus.CANCELLED}'`,
    atRow: 4,
  };

  await holdSave(cancelOnLastReminder, async (release) => {
    const cancel = startCancel(professional, sessionId);
    await waitUntilStuck(CANCEL_SAVING);
    await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await release();
    await cancel;
  });
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  const { reminders, deliveredIds, session } = await afterTheRace(sessionId);
  expect(session.status).toBe(SessionStatus.CANCELLED);
  expect(deliveredIds).toEqual([]);
  expect(reminders.map((reminder) => reminder.status)).toEqual(Array(4).fill(ReminderStatus.CANCELLED));
});

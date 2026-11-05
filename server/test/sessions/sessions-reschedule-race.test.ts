import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../../src/db.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { ReminderStatus } from "../../src/reminders/reminder-values.js";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, KOLKATA_SECOND, SESSIONS_URL, type Agent } from "../booking/helpers.js";
import { testDatabaseUrl } from "../db.js";
import { HOUR_BEFORE_DUE, bookOneSession, textsFor } from "../reminders/helpers.js";
import { holdSave, reschedule, waitUntilStuck } from "./helpers.js";

// One connection each for the hold, the two sides of a race, and watching them wait.
const db = createDb(testDatabaseUrl, { max: 5 });
const app = createTestApp(db, testClock(CLOCK_START).now);

const THIRD_SLOT = "2027-01-18T05:30:00Z";
// Each statement is found by a name only it contains.
const MOVE_SAVING = "dropped_reminders";
const CANCEL_SAVING = "cancelled_reminders";
const NEW_TIME = "Your session with Nora Quill is on Mon 18 Jan at 12:30pm";
const OLD_TIME = "11:30am";

const MOVE_ON_SESSION = {
  table: "sessions",
  event: "update",
  when: "new.starts_at is distinct from old.starts_at",
  atRow: 1,
};
const CANCEL_ON_SESSION = {
  table: "sessions",
  event: "update",
  when: `new.status = '${SessionStatus.CANCELLED}'`,
  atRow: 1,
};

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

// A supertest request only starts when something waits on it, so this starts it now.
function startMove(member: Agent, sessionId: string, start: string) {
  return Promise.resolve(reschedule(member, sessionId, start));
}

async function remindersFor(agent: Agent) {
  return (await textsFor(agent)).filter((text) => text.startsWith("Your session with"));
}

function startCancel(professional: Agent, sessionId: string) {
  return Promise.resolve(professional.post(`${SESSIONS_URL}/${sessionId}/cancel`).send({}));
}

it("a checker that runs while a move holds the old reminders delivers none of them", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  const moveOnLastReminder = {
    table: "reminders",
    event: "update",
    when: `new.status = '${ReminderStatus.CANCELLED}'`,
    atRow: 4,
  };

  await holdSave(db, moveOnLastReminder, async (release) => {
    const move = startMove(member, sessionId, KOLKATA_SECOND);
    await waitUntilStuck(db, MOVE_SAVING);
    await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await release();
    expect((await move).status).toBe(204);
  });
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  expect(await textsFor(member)).toEqual([NEW_TIME]);
  const professionalTexts = await textsFor(professional);
  expect(professionalTexts.filter((text) => text.includes("9:00am"))).toHaveLength(1);
  expect(professionalTexts.join()).not.toContain(OLD_TIME);
});

it("a move that waits for a checker holding the reminders leaves the delivered ones alone", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  const checkerSaving = {
    table: "notifications",
    event: "insert",
    when: "new.reminder_id is not null",
    atRow: 1,
  };

  await holdSave(db, checkerSaving, async (release) => {
    const check = deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
    await waitUntilStuck(db, "delivered as");
    const move = startMove(member, sessionId, KOLKATA_SECOND);
    await waitUntilStuck(db, MOVE_SAVING);
    await release();
    await check;
    expect((await move).status).toBe(204);
  });

  // The old reminders went out before the move saved, once each, and the new ones are still to come.
  expect((await textsFor(member)).filter((text) => text.includes(OLD_TIME))).toHaveLength(2);
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { id: sessionId, start: "2027-01-18T04:30:00.000Z" },
  ]);
  await deliverDueReminders(db, new Date("2027-01-18T03:30:00Z"));
  expect((await textsFor(professional)).filter((text) => text.includes("10:00am"))).toHaveLength(3);
});

it("a move can't overwrite a cancel that saves first", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  let moveStatus = 0;
  await holdSave(db, CANCEL_ON_SESSION, async (release) => {
    const cancel = startCancel(professional, sessionId);
    await waitUntilStuck(db, CANCEL_SAVING);
    const move = startMove(member, sessionId, KOLKATA_SECOND);
    await waitUntilStuck(db, MOVE_SAVING);
    await release();
    await cancel;
    moveStatus = (await move).status;
  });

  expect(moveStatus).toBe(404);
  const { upcoming, cancelled } = (await member.get(SESSIONS_URL)).body;
  expect(upcoming.items).toEqual([]);
  expect(cancelled.items).toMatchObject([{ id: sessionId, start: "2027-01-18T03:30:00.000Z" }]);
  await deliverDueReminders(db, new Date("2027-01-18T03:30:00Z"));
  expect(await remindersFor(member)).toEqual([]);
  expect(await remindersFor(professional)).toEqual([]);
});

it("two moves at the same moment: one wins, the other is refused, and the member still has one session", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  let statuses: number[] = [];
  await holdSave(db, MOVE_ON_SESSION, async (release) => {
    const first = startMove(member, sessionId, KOLKATA_SECOND);
    await waitUntilStuck(db, MOVE_SAVING);
    const second = startMove(member, sessionId, THIRD_SLOT);
    await waitUntilStuck(db, MOVE_SAVING, 2);
    await release();
    statuses = (await Promise.all([first, second])).map((res) => res.status);
  });

  expect(statuses).toEqual([204, 404]);
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { id: sessionId, start: "2027-01-18T04:30:00.000Z" },
  ]);
  await deliverDueReminders(db, new Date("2027-01-18T03:30:00Z"));
  expect(await textsFor(member)).toEqual([NEW_TIME, NEW_TIME]);
  expect(await textsFor(professional)).toHaveLength(3);
});

import { setTimeout as sleep } from "node:timers/promises";
import type { Express } from "express";
import type { Db } from "../../src/db.js";
import { SessionStatus } from "../../src/session-status.js";
import { signUpAgent, testMember, testProfessional } from "../app.js";
import {
  KOLKATA_FIRST,
  SESSIONS_URL,
  SINGAPORE_SLOT,
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
  type Agent,
} from "../booking/helpers.js";

export async function twoMembersAndTwoProfessionals(app: Express) {
  const nora = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const owen = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  const noraBooking = await book(theo, nora.id, KOLKATA_FIRST);
  await book(iris, owen.id, SINGAPORE_SLOT);
  return { nora, owen, theo, iris, theoSessionId: noraBooking.body.session.id as string };
}

type TestTrigger = { table: string; event: string; when?: string; body: string };

// Dropped first too, because a trigger left by a killed run would interfere with every later test.
export async function withTrigger(
  db: Db,
  { table, event, when = "true", body }: TestTrigger,
  run: () => Promise<void>,
) {
  const drop = "drop function if exists test_trigger() cascade";
  await db.raw(drop);
  await db.raw(
    `create function test_trigger() returns trigger language plpgsql as $$ begin ${body} return new; end $$`,
  );
  await db.raw(
    `create trigger test_trigger before ${event} on ${table} for each row when (${when}) execute function test_trigger()`,
  );
  try {
    await run();
  } finally {
    await db.raw(drop);
  }
}

export function reschedule(member: Agent, sessionId: string, start: string) {
  return member.post(`${SESSIONS_URL}/${sessionId}/reschedule`).send({ start });
}

const HOLD_LOCK_ID = 808;

type Hold = { table: string; event: string; when: string; atRow: number };

// Stops a save on one row until the test releases it, so the order of a race is chosen, not hoped for.
export async function holdSave(
  db: Db,
  { atRow, ...trigger }: Hold,
  run: (release: () => Promise<void>) => Promise<void>,
) {
  await db.raw("drop sequence if exists held_rows");
  await db.raw("create sequence held_rows");
  const holder = await db.transaction();
  await holder.raw("select pg_advisory_xact_lock(?)", [HOLD_LOCK_ID]);
  const body = `if nextval('held_rows') = ${atRow} then perform pg_advisory_xact_lock(${HOLD_LOCK_ID}); end if;`;
  try {
    await withTrigger(db, { ...trigger, body }, () =>
      run(async () => {
        await holder.commit();
      }),
    );
  } finally {
    if (!holder.isCompleted()) await holder.rollback();
    await db.raw("drop sequence held_rows");
  }
}

// Row locks and the hold both show here, so this proves a statement really is stuck rather than slow to start.
export async function waitUntilStuck(db: Db, statementPart: string, statements = 1) {
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

// The save of a cancel, for holding it in a race.
export const CANCEL_ON_SESSION = {
  table: "sessions",
  event: "update",
  when: `new.status = '${SessionStatus.CANCELLED}'`,
  atRow: 1,
};

// A supertest request only starts when something waits on it, so this starts it now.
export function startCancel(agent: Agent, sessionId: string) {
  return Promise.resolve(agent.post(`${SESSIONS_URL}/${sessionId}/cancel`).send({}));
}

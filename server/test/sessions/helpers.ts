import type { Express } from "express";
import type { Db } from "../../src/db.js";
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

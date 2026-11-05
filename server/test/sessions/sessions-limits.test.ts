import { afterAll, beforeEach, expect, it } from "vitest";
import { PAGE_SIZE } from "../../src/paging.js";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_STARTS,
  SESSIONS_URL,
  book,
  logIn,
  signUpProfessional,
  userId,
} from "../booking/helpers.js";

const AFTER_EVERY_SLOT = "2027-02-02T00:00:00Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

async function memberWithSessions(count: number) {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  for (const start of KOLKATA_STARTS.slice(0, count)) await book(member, professional.id, start);
  return { member, professionalId: professional.id };
}

it("upcoming stops at one page, and says more follow only when they do", async () => {
  const { member, professionalId } = await memberWithSessions(PAGE_SIZE);

  const full = (await member.get(SESSIONS_URL)).body.upcoming;
  expect(full.items).toHaveLength(PAGE_SIZE);
  expect(full.next).toBeNull();

  await book(member, professionalId, KOLKATA_STARTS[PAGE_SIZE]);

  const more = (await member.get(SESSIONS_URL)).body.upcoming;
  expect(more.items).toHaveLength(PAGE_SIZE);
  expect(more.next).toEqual(expect.any(String));
});

it("past stops at one page, and says more follow", async () => {
  const { member } = await memberWithSessions(PAGE_SIZE + 1);
  clock.set(AFTER_EVERY_SLOT);
  await logIn(member, testMember);

  const { past } = (await member.get(SESSIONS_URL)).body;

  expect(past.items).toHaveLength(PAGE_SIZE);
  expect(past.next).toEqual(expect.any(String));
});

it("cancelled stops at one page, and says more follow", async () => {
  const { member } = await memberWithSessions(PAGE_SIZE + 1);
  await db("sessions").update({
    status: SessionStatus.CANCELLED,
    cancelled_by: await userId(member),
    cancelled_at: new Date(CLOCK_START),
  });

  const { cancelled } = (await member.get(SESSIONS_URL)).body;

  expect(cancelled.items).toHaveLength(PAGE_SIZE);
  expect(cancelled.next).toEqual(expect.any(String));
});

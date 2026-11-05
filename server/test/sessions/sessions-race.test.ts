import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../../src/db.js";
import { ErrorCode } from "../../src/errors.js";
import { SessionStatus } from "../../src/session-status.js";
import { insertSession } from "../../src/sessions/store.js";
import { sessionEnd } from "../../src/slots/slots.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { testDatabaseUrl } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_SECOND,
  SINGAPORE_SLOT,
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
  userId,
  type Agent,
} from "./helpers.js";

const MEMBER_COUNT = 10;

const clock = testClock(CLOCK_START);

// A pool bigger than the shared test one, so the requests really run at the same time.
const db = createDb(testDatabaseUrl, { max: 12 });
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

async function signUpMembers(count: number) {
  const members: Agent[] = [];
  for (let i = 1; i <= count; i++) {
    members.push(
      await signUpAgent(app, { ...testMember, name: `Member ${i}`, email: `member${i}@example.com` }),
    );
  }
  return members;
}

async function bookedCount() {
  const [{ count }] = await db("sessions").where({ status: SessionStatus.BOOKED }).count({ count: "*" });
  return Number(count);
}

it("10 members booking the same slot at once: exactly one succeeds", async () => {
  const { id: professionalId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const members = await signUpMembers(MEMBER_COUNT);

  const results = await Promise.all(members.map((member) => book(member, professionalId, KOLKATA_SECOND)));

  expect(results.filter((res) => res.status === 201)).toHaveLength(1);
  const rejected = results.filter((res) => res.status !== 201);
  expect(rejected).toHaveLength(MEMBER_COUNT - 1);
  for (const res of rejected) {
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: ErrorCode.SLOT_TAKEN,
      message: "That time was just booked. Please pick another.",
    });
  }
  expect(await bookedCount()).toBe(1);
});

it("one member booking two professionals' overlapping slots at once gets only one", async () => {
  const { id: kolkataId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const { id: singaporeId } = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const member = await signUpAgent(app, testMember);

  const results = await Promise.all([
    book(member, kolkataId, KOLKATA_SECOND),
    book(member, singaporeId, SINGAPORE_SLOT),
  ]);

  expect(results.filter((res) => res.status === 201)).toHaveLength(1);
  const refused = results.find((res) => res.status !== 201);
  expect(refused?.status).toBe(409);
  expect(refused?.body).toEqual({
    error: ErrorCode.MEMBER_OVERLAP,
    message: "You already have a session at that time.",
  });
});

it("one member's two racing requests for the same slot make one session", async () => {
  const { id: professionalId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const results = await Promise.all([
    book(member, professionalId, KOLKATA_SECOND),
    book(member, professionalId, KOLKATA_SECOND),
  ]);

  expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
  expect(results.find((res) => res.status === 409)?.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
  expect(await bookedCount()).toBe(1);
});

it("maps the professional's overlap to SLOT_TAKEN", async () => {
  const { id: professionalId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  await book(theo, professionalId, KOLKATA_SECOND);
  const start = new Date(KOLKATA_SECOND);

  const result = await insertSession(db, {
    memberId: await userId(iris),
    professionalId,
    start,
    end: sessionEnd(start),
  });

  expect(result).toEqual({ refusal: ErrorCode.SLOT_TAKEN });
});

it("maps the member's overlap to MEMBER_OVERLAP", async () => {
  const { id: kolkataId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const { id: singaporeId } = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const member = await signUpAgent(app, testMember);
  await book(member, kolkataId, KOLKATA_SECOND);
  const start = new Date(SINGAPORE_SLOT);

  const result = await insertSession(db, {
    memberId: await userId(member),
    professionalId: singaporeId,
    start,
    end: sessionEnd(start),
  });

  expect(result).toEqual({ refusal: ErrorCode.MEMBER_OVERLAP });
});

it("maps an insert that breaks both overlap rules to MEMBER_OVERLAP", async () => {
  const { id: professionalId } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  await book(member, professionalId, KOLKATA_SECOND);
  const start = new Date(KOLKATA_SECOND);

  const result = await insertSession(db, {
    memberId: await userId(member),
    professionalId,
    start,
    end: sessionEnd(start),
  });

  expect(result).toEqual({ refusal: ErrorCode.MEMBER_OVERLAP });
});

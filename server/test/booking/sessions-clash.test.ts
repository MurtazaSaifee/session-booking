import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_SECOND,
  SINGAPORE_SLOT,
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
} from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

it("a second member booking the same slot is told it was taken", async () => {
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  await book(await signUpAgent(app, testMember), id, KOLKATA_FIRST);
  const iris = await signUpAgent(app, otherMember);

  const res = await book(iris, id, KOLKATA_FIRST);

  expect(res.status).toBe(409);
  expect(res.body).toEqual({
    error: ErrorCode.SLOT_TAKEN,
    message: "That time was just booked. Please pick another.",
  });
});

it("a member cannot book a slot that overlaps a session with another professional", async () => {
  const kolkata = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const singapore = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const member = await signUpAgent(app, testMember);
  await book(member, singapore.id, SINGAPORE_SLOT);

  const res = await book(member, kolkata.id, KOLKATA_SECOND);

  expect(res.status).toBe(409);
  expect(res.body).toEqual({
    error: ErrorCode.MEMBER_OVERLAP,
    message: "You already have a session at that time.",
  });
});

it("booking the same slot again says the member already has it, not that it was taken", async () => {
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  await book(member, id, KOLKATA_FIRST);

  const res = await book(member, id, KOLKATA_FIRST);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
});

it("a member can book two slots one after the other", async () => {
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const first = await book(member, id, KOLKATA_FIRST);
  const second = await book(member, id, KOLKATA_SECOND);

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
});

it("a time freed by a cancelled session can be booked", async () => {
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  await book(await signUpAgent(app, testMember), id, KOLKATA_FIRST);
  await db("sessions").update({ status: SessionStatus.CANCELLED });
  const iris = await signUpAgent(app, otherMember);

  const res = await book(iris, id, KOLKATA_FIRST);

  expect(res.status).toBe(201);
});

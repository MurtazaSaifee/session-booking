import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_SECOND,
  SESSIONS_URL,
  SINGAPORE_SLOT,
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
  userId,
} from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("refuses a request that is not signed in", async () => {
  const { id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");

  const res = await request(app).post(SESSIONS_URL).send({ professionalId: id, start: KOLKATA_FIRST });

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("a professional is refused with 403", async () => {
  const { agent, id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");

  const res = await book(agent, id, KOLKATA_FIRST);

  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: ErrorCode.WRONG_ROLE, message: "Only members can do this." });
});

it("books for the signed-in member and ignores a member id in the body", async () => {
  const kolkata = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const singapore = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  const irisId = await userId(iris);

  const booked = await theo
    .post(SESSIONS_URL)
    .send({ professionalId: kolkata.id, start: KOLKATA_SECOND, memberId: irisId });
  const theoClash = await book(theo, singapore.id, SINGAPORE_SLOT);
  const irisBooks = await book(iris, singapore.id, SINGAPORE_SLOT);

  expect(booked.status).toBe(201);
  expect(theoClash.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
  expect(irisBooks.status).toBe(201);
});

it("a time inside the notice gets the same 404 as any other when the professional doesn't exist", async () => {
  const member = await signUpAgent(app, testMember);
  const memberId = await userId(member);

  const named = await book(member, memberId, CLOCK_START);
  const missing = await book(member, "00000000-0000-4000-8000-000000000000", CLOCK_START);

  expect(named.status).toBe(404);
  expect(named.body).toEqual(missing.body);
});

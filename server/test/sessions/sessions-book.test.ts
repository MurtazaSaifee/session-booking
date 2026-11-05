import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { SessionStatus } from "../../src/session-status.js";
import { SESSION_MINUTES } from "../../src/slots/slots.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";

const otherMember = {
  ...testMember,
  name: "Iris Penn",
  email: "iris@example.com",
  timezone: "Europe/London",
};

const singaporeProfessional = {
  ...testProfessional,
  name: "Owen Hale",
  email: "owen@example.com",
  timezone: "Asia/Singapore",
};

const MONDAY = 1;
const SESSIONS_URL = `${API_V1}/sessions`;
const CLOCK_START = "2027-01-11T04:00:00Z";

// Next Monday's slots with the Kolkata professional's 09:00-12:00 hours.
const KOLKATA_FIRST = "2027-01-18T03:30:00Z";
const KOLKATA_SECOND = "2027-01-18T04:30:00Z";
// The Singapore professional's 13:00-14:00 hours overlap the Kolkata second slot.
const SINGAPORE_SLOT = "2027-01-18T05:00:00Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

async function signUpProfessional(user: typeof testProfessional, start: string, end: string) {
  const agent = await signUpAgent(app, user);
  const { id } = (await agent.get(`${API_V1}/auth/me`)).body.user;
  await agent.put(`${API_V1}/settings/hours`).send({ ranges: [{ weekday: MONDAY, start, end }] });
  return { agent, id: id as string };
}

function book(member: Awaited<ReturnType<typeof signUpAgent>>, professionalId: string, start: string) {
  return member.post(SESSIONS_URL).send({ professionalId, start });
}

it("a member books a free slot", async () => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const res = await book(member, id, KOLKATA_FIRST);

  expect(res.status).toBe(201);
  expect(res.body).toEqual({
    session: {
      id: expect.any(String),
      professionalId: id,
      start: new Date(KOLKATA_FIRST).toISOString(),
      end: new Date(new Date(KOLKATA_FIRST).getTime() + SESSION_MINUTES * 60_000).toISOString(),
      status: SessionStatus.BOOKED,
    },
  });
});

it("refuses a request that is not signed in", async () => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");

  const res = await request(app).post(SESSIONS_URL).send({ professionalId: id, start: KOLKATA_FIRST });

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("a professional is refused with 403", async () => {
  const { agent, id } = await signUpProfessional(testProfessional, "09:00", "12:00");

  const res = await book(agent, id, KOLKATA_FIRST);

  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: ErrorCode.WRONG_ROLE, message: "Only members can do this." });
});

it.each([
  { case: "a missing start", body: (id: string) => ({ professionalId: id }) },
  {
    case: "a start that is not a time",
    body: (id: string) => ({ professionalId: id, start: "next monday" }),
  },
  { case: "a missing professional id", body: () => ({ start: KOLKATA_FIRST }) },
])("refuses $case with 400", async ({ body }) => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const res = await member.post(SESSIONS_URL).send(body(id));

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
});

it.each([
  { case: "a malformed id", id: () => "not-a-uuid" },
  { case: "an unknown id", id: () => "00000000-0000-4000-8000-000000000000" },
  { case: "a member's id", id: (memberId: string) => memberId },
])("refuses $case with 404", async ({ id }) => {
  await signUpProfessional(testProfessional, "09:00", "12:00");
  const iris = await signUpAgent(app, otherMember);
  const irisId = (await iris.get(`${API_V1}/auth/me`)).body.user.id;
  const member = await signUpAgent(app, testMember);

  const res = await book(member, id(irisId), KOLKATA_FIRST);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

it.each([
  { case: "a time in the past", start: "2027-01-11T03:30:00Z" },
  { case: "a time off the hourly grid", start: "2027-01-18T03:47:00Z" },
  { case: "a time on the hourly grid as working hours end", start: "2027-01-18T06:30:00Z" },
  { case: "a time beyond 4 weeks", start: "2027-02-08T04:30:00Z" },
])("refuses $case with 422", async ({ start }) => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const res = await book(member, id, start);

  expect(res.status).toBe(422);
  expect(res.body).toEqual({ error: ErrorCode.SLOT_NOT_AVAILABLE, message: "That time isn't available." });
});

it("a second member booking the same slot is told it was taken", async () => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
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
  const kolkata = await signUpProfessional(testProfessional, "09:00", "12:00");
  const singapore = await signUpProfessional(singaporeProfessional, "13:00", "14:00");
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
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  await book(member, id, KOLKATA_FIRST);

  const res = await book(member, id, KOLKATA_FIRST);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
});

it("a member can book two slots one after the other", async () => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const first = await book(member, id, KOLKATA_FIRST);
  const second = await book(member, id, KOLKATA_SECOND);

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
});

it("books for the signed-in member and ignores a member id in the body", async () => {
  const kolkata = await signUpProfessional(testProfessional, "09:00", "12:00");
  const singapore = await signUpProfessional(singaporeProfessional, "13:00", "14:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  const irisId = (await iris.get(`${API_V1}/auth/me`)).body.user.id;

  const booked = await theo
    .post(SESSIONS_URL)
    .send({ professionalId: kolkata.id, start: KOLKATA_SECOND, memberId: irisId });
  const theoClash = await book(theo, singapore.id, SINGAPORE_SLOT);
  const irisBooks = await book(iris, singapore.id, SINGAPORE_SLOT);

  expect(booked.status).toBe(201);
  expect(theoClash.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
  expect(irisBooks.status).toBe(201);
});

it("a time freed by a cancelled session can be booked", async () => {
  const { id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  await book(await signUpAgent(app, testMember), id, KOLKATA_FIRST);
  await db("sessions").update({ status: SessionStatus.CANCELLED });
  const iris = await signUpAgent(app, otherMember);

  const res = await book(iris, id, KOLKATA_FIRST);

  expect(res.status).toBe(201);
});

it("hours that were replaced no longer count", async () => {
  const { agent, id } = await signUpProfessional(testProfessional, "09:00", "12:00");
  await agent
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: MONDAY, start: "13:00", end: "14:00" }] });
  const member = await signUpAgent(app, testMember);

  const res = await book(member, id, KOLKATA_FIRST);

  expect(res.status).toBe(422);
  expect(res.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);
});

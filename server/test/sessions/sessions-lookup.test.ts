import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  SESSIONS_URL,
  type Agent,
  book,
  signUpProfessional,
} from "../booking/helpers.js";

const FIRST_ENDS = "2027-01-18T04:20:00.000Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

async function setUp() {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  return { professional, member };
}

async function bookId(member: Agent, professionalId: string, start: string) {
  return (await book(member, professionalId, start)).body.session.id as string;
}

it("looks up one session for either person on it", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);

  const memberView = await member.get(`${SESSIONS_URL}/${id}`);
  const professionalView = await professional.agent.get(`${SESSIONS_URL}/${id}`);

  expect(memberView.status).toBe(200);
  expect(memberView.body.session).toEqual({
    id,
    otherPersonName: testProfessional.name,
    professionalId: professional.id,
    start: "2027-01-18T03:30:00.000Z",
    end: FIRST_ENDS,
    status: SessionStatus.BOOKED,
    cancelledBy: null,
  });
  expect(professionalView.body.session.otherPersonName).toBe(testMember.name);
});

it.each([
  ["an id that doesn't exist", "00000000-0000-4000-8000-000000000000"],
  ["a malformed id", "not-a-uuid"],
])("looking up %s gives a 404", async (_name, id) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${SESSIONS_URL}/${id}`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that session." });
});

import { afterAll, beforeEach, expect, it } from "vitest";
import { SessionStatus } from "../../src/session-status.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_SECOND,
  SESSIONS_URL,
  type Agent,
  book,
  logIn,
  signUpProfessional,
} from "../booking/helpers.js";

const FIRST_ENDS = "2027-01-18T04:20:00.000Z";
const SECOND_ENDS = "2027-01-18T05:20:00.000Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

function mySessions(agent: Agent) {
  return agent.get(SESSIONS_URL);
}

async function memberSessionsAt(member: Agent, time: string) {
  clock.set(time);
  await logIn(member, testMember);
  return (await mySessions(member)).body;
}

async function setUp() {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  return { professional, member };
}

async function bookId(member: Agent, professionalId: string, start: string) {
  return (await book(member, professionalId, start)).body.session.id as string;
}

it("shows a member the professional's name and the session's times", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);

  const res = await mySessions(member);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    upcoming: {
      items: [
        {
          id,
          otherPersonName: testProfessional.name,
          professionalId: professional.id,
          start: "2027-01-18T03:30:00.000Z",
          end: FIRST_ENDS,
          status: SessionStatus.BOOKED,
          cancelledBy: null,
        },
      ],
      next: null,
    },
    past: { items: [], next: null },
    cancelled: { items: [], next: null },
  });
});

it("shows a professional the member's name", async () => {
  const { professional, member } = await setUp();
  await book(member, professional.id, KOLKATA_FIRST);

  const res = await mySessions(professional.agent);

  expect(res.body.upcoming.items[0].otherPersonName).toBe(testMember.name);
});

it("keeps a session in upcoming until its end time has gone by", async () => {
  const { professional, member } = await setUp();
  await book(member, professional.id, KOLKATA_FIRST);

  const started = await memberSessionsAt(member, KOLKATA_FIRST);
  const lastMoment = await memberSessionsAt(member, "2027-01-18T04:19:59.999Z");
  const ended = await memberSessionsAt(member, FIRST_ENDS);

  expect(started.upcoming.items).toHaveLength(1);
  expect(lastMoment.upcoming.items).toHaveLength(1);
  expect(ended.upcoming.items).toHaveLength(0);
  expect(ended.past.items).toHaveLength(1);
});

it("lists upcoming soonest first and past most recent first", async () => {
  const { professional, member } = await setUp();
  await book(member, professional.id, KOLKATA_SECOND);
  await book(member, professional.id, KOLKATA_FIRST);

  const upcoming = (await mySessions(member)).body.upcoming.items;
  const past = (await memberSessionsAt(member, "2027-01-19T00:00:00Z")).past.items;

  expect(upcoming.map((session: { end: string }) => session.end)).toEqual([FIRST_ENDS, SECOND_ENDS]);
  expect(past.map((session: { end: string }) => session.end)).toEqual([SECOND_ENDS, FIRST_ENDS]);
});

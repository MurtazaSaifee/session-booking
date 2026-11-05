import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { PAGE_SIZE } from "../../src/paging.js";
import { API_V1 } from "../../src/paths.js";
import { SessionStatus } from "../../src/session-status.js";
import { CancelledBy } from "../../src/sessions/store.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_SECOND,
  SESSIONS_URL,
  type Agent,
  book,
  markCancelled,
  signUpProfessional,
  userId,
} from "../booking/helpers.js";

const FIRST_ENDS = "2027-01-18T04:20:00.000Z";
const SECOND_ENDS = "2027-01-18T05:20:00.000Z";
// Slots on the next three Mondays with 09:00-17:00 hours in Kolkata.
const MONDAYS = ["2027-01-18", "2027-01-25", "2027-02-01"];
const KOLKATA_START_TIMES = ["03:30", "04:30", "05:30", "06:30", "07:30", "08:30", "09:30", "10:30"];

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

// A week's jump also expires the sign-in, so the member logs in again at the new time.
async function memberSessionsAt(member: Agent, time: string) {
  clock.set(time);
  await member.post(`${API_V1}/auth/login`).send({ email: testMember.email, password: testMember.password });
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

it("lists a cancelled session only under cancelled, whether its time is ahead or gone", async () => {
  const { professional, member } = await setUp();
  const ahead = await bookId(member, professional.id, KOLKATA_FIRST);
  const gone = await bookId(member, professional.id, KOLKATA_SECOND);
  await markCancelled(db, ahead, await userId(member), CLOCK_START);
  await markCancelled(db, gone, await userId(member), CLOCK_START);

  const res = await memberSessionsAt(member, "2027-01-18T04:25:00Z");

  expect(res.upcoming.items).toEqual([]);
  expect(res.past.items).toEqual([]);
  expect(res.cancelled.items.map((session: { id: string }) => session.id)).toEqual([gone, ahead]);
  expect(res.cancelled.items[0].status).toBe(SessionStatus.CANCELLED);
});

it("tells each person whether they were the one who cancelled", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);
  await markCancelled(db, id, professional.id, CLOCK_START);

  const professionalView = (await mySessions(professional.agent)).body.cancelled.items[0];
  const memberView = (await mySessions(member)).body.cancelled.items[0];

  expect(professionalView.cancelledBy).toBe(CancelledBy.YOU);
  expect(memberView.cancelledBy).toBe(CancelledBy.OTHER_PERSON);
});

it("doesn't guess when a cancelled session has no record of who cancelled it", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);
  await db("sessions").where({ id }).update({ status: SessionStatus.CANCELLED });

  const memberView = (await mySessions(member)).body.cancelled.items[0];
  const professionalView = (await mySessions(professional.agent)).body.cancelled.items[0];

  expect(memberView.cancelledBy).toBeNull();
  expect(professionalView.cancelledBy).toBeNull();
});

it("a time cancelled and rebooked shows one row in upcoming and one under cancelled", async () => {
  const { professional, member } = await setUp();
  const old = await bookId(member, professional.id, KOLKATA_FIRST);
  await markCancelled(db, old, await userId(member), CLOCK_START);
  const rebooked = await bookId(member, professional.id, KOLKATA_FIRST);

  const res = (await mySessions(member)).body;

  expect(res.upcoming.items.map((session: { id: string }) => session.id)).toEqual([rebooked]);
  expect(res.cancelled.items.map((session: { id: string }) => session.id)).toEqual([old]);
});

it("returns at most one page of each list, and says when more follow", async () => {
  const { professional, member } = await setUp();
  const starts = MONDAYS.flatMap((day) => KOLKATA_START_TIMES.map((time) => `${day}T${time}:00Z`));
  for (const start of starts.slice(0, PAGE_SIZE)) await book(member, professional.id, start);

  const full = (await mySessions(member)).body.upcoming;
  expect(full.items).toHaveLength(PAGE_SIZE);
  expect(full.next).toBeNull();

  await book(member, professional.id, starts[PAGE_SIZE]);

  const more = (await mySessions(member)).body.upcoming;
  expect(more.items).toHaveLength(PAGE_SIZE);
  expect(more.next).toEqual(expect.any(String));
});

it("looks up one session for either person on it", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);

  const memberView = await member.get(`${SESSIONS_URL}/${id}`);
  const professionalView = await professional.agent.get(`${SESSIONS_URL}/${id}`);

  expect(memberView.status).toBe(200);
  expect(memberView.body.session).toEqual({
    id,
    otherPersonName: testProfessional.name,
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

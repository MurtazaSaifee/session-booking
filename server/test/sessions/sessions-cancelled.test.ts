import { afterAll, beforeEach, expect, it } from "vitest";
import { SessionStatus } from "../../src/session-status.js";
import { CancelledBy } from "../../src/sessions/my-session.js";
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
  markCancelled,
  signUpProfessional,
  userId,
} from "../booking/helpers.js";

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

it("lists a cancelled session only under cancelled, whether its time is ahead or gone", async () => {
  const { professional, member } = await setUp();
  const gone = await bookId(member, professional.id, KOLKATA_FIRST);
  const ahead = await bookId(member, professional.id, KOLKATA_SECOND);
  await markCancelled(db, gone, await userId(member), CLOCK_START);
  await markCancelled(db, ahead, await userId(member), CLOCK_START);

  const res = await memberSessionsAt(member, "2027-01-18T04:25:00Z");

  expect(res.upcoming.items).toEqual([]);
  expect(res.past.items).toEqual([]);
  expect(res.cancelled.items.map((session: { id: string }) => session.id)).toEqual([ahead, gone]);
  expect(res.cancelled.items[0].status).toBe(SessionStatus.CANCELLED);
});

// A member's row also carries the professional's id, for the reschedule calendar.
function cancelledRow(
  id: string,
  otherPersonName: string,
  cancelledBy: CancelledBy,
  professionalId?: string,
) {
  return {
    id,
    otherPersonName,
    ...(professionalId && { professionalId }),
    start: "2027-01-18T03:30:00.000Z",
    end: "2027-01-18T04:20:00.000Z",
    status: SessionStatus.CANCELLED,
    cancelledBy,
  };
}

it("shows exactly the cancelled row, with no id for the member, when the professional cancels", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);
  await markCancelled(db, id, professional.id, CLOCK_START);

  const professionalView = (await mySessions(professional.agent)).body.cancelled.items;
  const memberView = (await mySessions(member)).body.cancelled.items;

  expect(professionalView).toEqual([cancelledRow(id, testMember.name, CancelledBy.YOU)]);
  expect(memberView).toEqual([
    cancelledRow(id, testProfessional.name, CancelledBy.OTHER_PERSON, professional.id),
  ]);
});

it("shows exactly the cancelled row, with no id for the member, when the member cancels", async () => {
  const { professional, member } = await setUp();
  const id = await bookId(member, professional.id, KOLKATA_FIRST);
  await markCancelled(db, id, await userId(member), CLOCK_START);

  const professionalView = (await mySessions(professional.agent)).body.cancelled.items;
  const memberView = (await mySessions(member)).body.cancelled.items;

  expect(professionalView).toEqual([cancelledRow(id, testMember.name, CancelledBy.OTHER_PERSON)]);
  expect(memberView).toEqual([cancelledRow(id, testProfessional.name, CancelledBy.YOU, professional.id)]);
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

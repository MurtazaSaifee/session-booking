import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock } from "../app.js";
import { CLOCK_START, book, otherMember } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { bookOneSession } from "../reminders/helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

// Nora's session is 09:00-09:50 in Kolkata. New hours from 09:30 leave it alone but offer 09:30-10:20 across it.
const ACROSS_THE_SESSION = "2027-01-18T04:00:00.000Z";
const NEW_HOURS = { ranges: [{ weekday: 1, start: "09:30", end: "12:30" }] };

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

async function slotStarts(
  agent: Awaited<ReturnType<typeof signUpAgent>>,
  professionalId: string,
  query = "",
) {
  const res = await agent.get(`${API_V1}/professionals/${professionalId}/slots${query}`);
  return (res.body.slots as { start: string }[]).map((slot) => slot.start);
}

async function acrossTheSessionSetUp() {
  const booked = await bookOneSession(app);
  await booked.professional.put(`${API_V1}/settings/hours`).send(NEW_HOURS);
  return booked;
}

it("hides a slot across the member's own session, unless that session is the one being moved", async () => {
  const { member, professionalId, sessionId } = await acrossTheSessionSetUp();

  expect(await slotStarts(member, professionalId)).not.toContain(ACROSS_THE_SESSION);
  expect(await slotStarts(member, professionalId, `?ignoreSessionId=${sessionId}`)).toContain(
    ACROSS_THE_SESSION,
  );
});

it("naming another member's session changes nothing, so it can't reveal that it is there", async () => {
  const { professionalId, sessionId } = await acrossTheSessionSetUp();
  const iris = await signUpAgent(app, otherMember);

  const plain = await slotStarts(iris, professionalId);
  const naming = await slotStarts(iris, professionalId, `?ignoreSessionId=${sessionId}`);

  expect(naming).toEqual(plain);
  expect(naming).not.toContain(ACROSS_THE_SESSION);
});

it("refuses a session id that isn't one", async () => {
  const { member, professionalId } = await bookOneSession(app);

  const res = await member.get(`${API_V1}/professionals/${professionalId}/slots?ignoreSessionId=nope`);

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
});

it("a booking still can't land across the member's own session", async () => {
  const { member, professionalId } = await acrossTheSessionSetUp();

  const res = await book(member, professionalId, ACROSS_THE_SESSION);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.MEMBER_OVERLAP);
});

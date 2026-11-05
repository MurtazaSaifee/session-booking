import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../src/db.js";
import { ErrorCode } from "../src/errors.js";
import { API_V1 } from "../src/paths.js";
import { sessionEnd } from "../src/sessions/booking.js";
import { SessionStatus } from "../src/sessions/status.js";
import { insertSession } from "../src/sessions/store.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "./app.js";
import { testDatabaseUrl } from "./db.js";

const MONDAY = 1;
const SESSIONS_URL = `${API_V1}/sessions`;
const CLOCK_START = "2027-01-11T04:00:00Z";
const MEMBER_COUNT = 10;

// Next Monday's slots with the Kolkata professional's 09:00-12:00 hours.
const KOLKATA_SECOND = "2027-01-18T04:30:00Z";
// The Singapore professional's 13:00-14:00 hours overlap the Kolkata second slot.
const SINGAPORE_SLOT = "2027-01-18T05:00:00Z";

const singaporeProfessional = {
  ...testProfessional,
  name: "Owen Hale",
  email: "owen@example.com",
  timezone: "Asia/Singapore",
};

const clock = testClock(CLOCK_START);

// A pool bigger than the shared test one, so the requests really run at the same time.
const db = createDb(testDatabaseUrl, { max: 12 });
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

type Agent = Awaited<ReturnType<typeof signUpAgent>>;

async function signUpProfessional(user: typeof testProfessional, start: string, end: string) {
  const agent = await signUpAgent(app, user);
  const id = await userId(agent);
  await agent.put(`${API_V1}/settings/hours`).send({ ranges: [{ weekday: MONDAY, start, end }] });
  return id;
}

async function userId(agent: Agent) {
  return (await agent.get(`${API_V1}/auth/me`)).body.user.id as string;
}

async function signUpMembers(count: number) {
  const members: Agent[] = [];
  for (let i = 1; i <= count; i++) {
    members.push(
      await signUpAgent(app, { ...testMember, name: `Member ${i}`, email: `member${i}@example.com` }),
    );
  }
  return members;
}

function book(member: Agent, professionalId: string, start: string) {
  return member.post(SESSIONS_URL).send({ professionalId, start });
}

async function bookedCount() {
  const [{ count }] = await db("sessions").where({ status: SessionStatus.BOOKED }).count({ count: "*" });
  return Number(count);
}

it("10 members booking the same slot at once: exactly one succeeds", async () => {
  const professionalId = await signUpProfessional(testProfessional, "09:00", "12:00");
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
  const kolkataId = await signUpProfessional(testProfessional, "09:00", "12:00");
  const singaporeId = await signUpProfessional(singaporeProfessional, "13:00", "14:00");
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
  const professionalId = await signUpProfessional(testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const results = await Promise.all([
    book(member, professionalId, KOLKATA_SECOND),
    book(member, professionalId, KOLKATA_SECOND),
  ]);

  expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
  expect(await bookedCount()).toBe(1);
});

it("maps the professional's overlap to SLOT_TAKEN", async () => {
  const professionalId = await signUpProfessional(testProfessional, "09:00", "12:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, { ...testMember, name: "Iris Penn", email: "iris@example.com" });
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
  const kolkataId = await signUpProfessional(testProfessional, "09:00", "12:00");
  const singaporeId = await signUpProfessional(singaporeProfessional, "13:00", "14:00");
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

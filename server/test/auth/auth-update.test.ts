import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { KOLKATA_SECOND, SESSIONS_URL, book, signUpProfessional, type Agent } from "../booking/helpers.js";
import { createTestDb } from "../db.js";

const START = "2027-01-15T09:00:00Z";
const clock = testClock(START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(START);
  await resetDb(db);
});

afterAll(() => db.destroy());

it("refuses updates when not signed in with 401", async () => {
  const res = await request(app).patch(`${API_V1}/auth/me`).send({ name: "Anyone" });
  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("a member updates their name and timezone", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member.patch(`${API_V1}/auth/me`).send({
    name: "Theo Updated",
    timezone: "Europe/London",
  });

  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({
    name: "Theo Updated",
    timezone: "Europe/London",
    email: testMember.email,
  });

  const me = await member.get(`${API_V1}/auth/me`);
  expect(me.body.user.name).toBe("Theo Updated");
  expect(me.body.user.timezone).toBe("Europe/London");
});

it("a professional updates only their timezone", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.patch(`${API_V1}/auth/me`).send({
    timezone: "Asia/Singapore",
  });

  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({
    name: testProfessional.name,
    timezone: "Asia/Singapore",
    title: testProfessional.title,
    bio: testProfessional.bio,
  });
});

it("refuses an empty update payload with 400", async () => {
  const member = await signUpAgent(app, testMember);
  const res = await member.patch(`${API_V1}/auth/me`).send({});

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
  expect(res.body.message).toBe("Nothing to update.");
});

it("refuses an invalid timezone with 400", async () => {
  const member = await signUpAgent(app, testMember);
  const res = await member.patch(`${API_V1}/auth/me`).send({ timezone: "Invalid/Not_A_Zone" });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
  expect(res.body.message).toBe("Please choose a valid timezone.");
});

it("refuses a blank name with 400", async () => {
  const member = await signUpAgent(app, testMember);
  const res = await member.patch(`${API_V1}/auth/me`).send({ name: "   " });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
  expect(res.body.message).toBe("Please enter your name.");
});

async function firstSlot(agent: Agent, professionalId: string) {
  const res = await agent.get(`${API_V1}/professionals/${professionalId}/slots`);
  return res.body.slots[0].start as string;
}

it("a professional's new timezone moves their free slots but not their hours or booked sessions", async () => {
  const { agent: professional, id } = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  await book(member, id, KOLKATA_SECOND);
  const hoursBefore = (await professional.get(`${API_V1}/settings/hours`)).body;
  expect(await firstSlot(member, id)).toBe("2027-01-18T03:30:00.000Z");

  await professional.patch(`${API_V1}/auth/me`).send({ timezone: "America/New_York" });

  // Monday 09:00 is now 09:00 in New York.
  expect(await firstSlot(member, id)).toBe("2027-01-18T14:00:00.000Z");
  expect((await professional.get(`${API_V1}/settings/hours`)).body).toEqual(hoursBefore);

  const upcoming = (await member.get(SESSIONS_URL)).body.upcoming.items;
  expect(upcoming.map((session: { start: string }) => session.start)).toEqual([
    new Date(KOLKATA_SECOND).toISOString(),
  ]);

  for (const agent of [member, professional]) {
    const notifications = await agent.get(`${API_V1}/notifications`);
    expect(notifications.body.unreadCount).toBe(0);
  }
});

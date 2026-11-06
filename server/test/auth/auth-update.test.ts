import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
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

import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { API_V1 } from "../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember } from "./app.js";
import { createTestDb } from "./db.js";

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("settings routes return 401 when not signed in", async () => {
  const res = await request(app).get(`${API_V1}/settings/profile`);

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("settings routes return 403 to a signed-in member", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/settings/profile`);

  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: ErrorCode.WRONG_ROLE, message: "Only professionals can do this." });
});

it("a signed-in member cannot update a profile", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member
    .patch(`${API_V1}/settings/profile`)
    .send({ title: "Coach", bio: "Helping people." });

  expect(res.status).toBe(403);
  expect(res.body.error).toBe(ErrorCode.WRONG_ROLE);
});

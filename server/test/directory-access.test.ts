import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { API_V1 } from "../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "./app.js";
import { createTestDb } from "./db.js";

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("the directory returns 401 when not signed in", async () => {
  const res = await request(app).get(`${API_V1}/professionals`);

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("the directory returns 403 to a signed-in professional", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.get(`${API_V1}/professionals`);

  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: ErrorCode.WRONG_ROLE, message: "Only members can do this." });
});

it("a member's id gives the same 404 as a missing professional", async () => {
  const member = await signUpAgent(app, testMember);
  const { id } = (await member.get(`${API_V1}/auth/me`)).body.user;

  const res = await member.get(`${API_V1}/professionals/${id}`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

it("a member's id on the slots path gives the same 404", async () => {
  const member = await signUpAgent(app, testMember);
  const { id } = (await member.get(`${API_V1}/auth/me`)).body.user;

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

it("a signed-in professional gets 403 on the slots path", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;

  const res = await professional.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: ErrorCode.WRONG_ROLE, message: "Only members can do this." });
});

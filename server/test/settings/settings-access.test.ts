import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";

const MONDAY = 1;

const otherProfessional = {
  ...testProfessional,
  name: "Ivo Brandt",
  email: "ivo@example.com",
  timezone: "Europe/London",
};

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("settings routes return 401 when not signed in", async () => {
  const profile = await request(app).get(`${API_V1}/settings/profile`);
  const hours = await request(app).get(`${API_V1}/settings/hours`);

  expect(profile.status).toBe(401);
  expect(profile.body.error).toBe(ErrorCode.UNAUTHENTICATED);
  expect(hours.status).toBe(401);
  expect(hours.body.error).toBe(ErrorCode.UNAUTHENTICATED);
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

it("minimum notice can't be saved when signed out or by a member", async () => {
  const member = await signUpAgent(app, testMember);
  const change = { minimumNoticeMinutes: 0 };

  const signedOut = await request(app).patch(`${API_V1}/settings/profile`).send(change);
  const asMember = await member.patch(`${API_V1}/settings/profile`).send(change);

  expect(signedOut.status).toBe(401);
  expect(signedOut.body.error).toBe(ErrorCode.UNAUTHENTICATED);
  expect(asMember.status).toBe(403);
  expect(asMember.body.error).toBe(ErrorCode.WRONG_ROLE);
});

it("a professional's minimum notice changes only their own, whatever id the request names", async () => {
  const nora = await signUpAgent(app, testProfessional);
  const ivo = await signUpAgent(app, otherProfessional);
  const ivoId = (await ivo.get(`${API_V1}/auth/me`)).body.user.id as string;

  await nora
    .patch(`${API_V1}/settings/profile`)
    .send({ minimumNoticeMinutes: 30, id: ivoId, professionalId: ivoId });

  expect((await nora.get(`${API_V1}/settings/profile`)).body.profile.minimumNoticeMinutes).toBe(30);
  expect((await ivo.get(`${API_V1}/settings/profile`)).body.profile.minimumNoticeMinutes).toBe(120);
});

it("a signed-in member cannot read or save working hours", async () => {
  const member = await signUpAgent(app, testMember);

  const read = await member.get(`${API_V1}/settings/hours`);
  const save = await member
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "17:00" }] });

  expect(read.status).toBe(403);
  expect(read.body.error).toBe(ErrorCode.WRONG_ROLE);
  expect(save.status).toBe(403);
  expect(save.body.error).toBe(ErrorCode.WRONG_ROLE);
});

it("a professional cannot see another professional's hours", async () => {
  const nora = await signUpAgent(app, testProfessional);
  const ivo = await signUpAgent(app, otherProfessional);
  await nora
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "17:00" }] });

  const res = await ivo.get(`${API_V1}/settings/hours`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ranges: [] });
});

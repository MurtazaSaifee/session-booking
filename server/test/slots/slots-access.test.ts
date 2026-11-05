import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";

const MONDAY = 1;

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

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

it("the slots response leaks no booking details", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  await professional
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "11:00" }] });
  const booker = await signUpAgent(app, testMember);
  const bookerId = (await booker.get(`${API_V1}/auth/me`)).body.user.id;
  const booked = await booker
    .post(`${API_V1}/sessions`)
    .send({ professionalId: id, start: "2027-01-18T03:30:00Z" });
  const viewer = await signUpAgent(app, { ...testMember, name: "Iris Penn", email: "iris@example.com" });

  const res = await viewer.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(200);
  expect(Object.keys(res.body)).toEqual(["slots"]);
  expect(res.body.slots.length).toBeGreaterThan(0);
  for (const slot of res.body.slots) {
    expect(Object.keys(slot).sort()).toEqual(["end", "start"]);
  }
  for (const secret of [bookerId, booked.body.session.id, testMember.name, testMember.email]) {
    expect(res.text).not.toContain(secret);
  }
});

import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { API_V1 } from "../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testProfessional } from "./app.js";
import { createTestDb } from "./db.js";

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("a professional reads their own title and bio", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.get(`${API_V1}/settings/profile`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ profile: { title: testProfessional.title, bio: testProfessional.bio } });
});

it("a professional updates their title and bio", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const update = { title: "Career coach", bio: "I help people change direction." };

  const res = await professional.patch(`${API_V1}/settings/profile`).send(update);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ profile: update });
  const after = await professional.get(`${API_V1}/settings/profile`);
  expect(after.body).toEqual({ profile: update });
});

it("changing only the bio keeps the title", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional
    .patch(`${API_V1}/settings/profile`)
    .send({ bio: "I help people change direction." });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    profile: { title: testProfessional.title, bio: "I help people change direction." },
  });
});

it("refuses a change with no fields", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.patch(`${API_V1}/settings/profile`).send({});

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: ErrorCode.VALIDATION, message: "Nothing to update." });
});

it("trims whitespace around the title and bio", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional
    .patch(`${API_V1}/settings/profile`)
    .send({ title: "  Career coach  ", bio: "  I help people change direction.  " });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    profile: { title: "Career coach", bio: "I help people change direction." },
  });
});

it("refuses an empty title and keeps the saved profile", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.patch(`${API_V1}/settings/profile`).send({ title: "", bio: "New bio" });

  expect(res.status).toBe(400);
  expect(res.body).toEqual({
    error: ErrorCode.VALIDATION,
    message: "Please enter your role, e.g. Counsellor.",
  });
  const after = await professional.get(`${API_V1}/settings/profile`);
  expect(after.body).toEqual({ profile: { title: testProfessional.title, bio: testProfessional.bio } });
});

it("ignores fields other than title and bio", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.patch(`${API_V1}/settings/profile`).send({
    title: "Career coach",
    bio: "I help people change direction.",
    email: "someone-else@example.com",
  });

  expect(res.status).toBe(200);
  const me = await professional.get(`${API_V1}/auth/me`);
  expect(me.body.user.email).toBe(testProfessional.email);
});

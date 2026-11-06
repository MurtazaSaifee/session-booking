import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";

const DEFAULT_NOTICE = 120;
const LONGEST_NOTICE = 28 * 24 * 60;
const defaultProfile = {
  title: testProfessional.title,
  bio: testProfessional.bio,
  minimumNoticeMinutes: DEFAULT_NOTICE,
};

const clock = testClock("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("a professional reads their own title and bio", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.get(`${API_V1}/settings/profile`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ profile: defaultProfile });
});

it("a professional updates their title and bio", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const update = { title: "Career coach", bio: "I help people change direction." };

  const res = await professional.patch(`${API_V1}/settings/profile`).send(update);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ profile: { ...update, minimumNoticeMinutes: DEFAULT_NOTICE } });
  const after = await professional.get(`${API_V1}/settings/profile`);
  expect(after.body).toEqual(res.body);
});

it("changing only the bio keeps the title", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional
    .patch(`${API_V1}/settings/profile`)
    .send({ bio: "I help people change direction." });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    profile: { ...defaultProfile, bio: "I help people change direction." },
  });
});

it("refuses a change with no fields", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.patch(`${API_V1}/settings/profile`).send({});

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: ErrorCode.VALIDATION, message: "Nothing to update." });
});

it("refuses a change with only unknown fields", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional
    .patch(`${API_V1}/settings/profile`)
    .send({ email: "someone-else@example.com" });

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
    profile: {
      title: "Career coach",
      bio: "I help people change direction.",
      minimumNoticeMinutes: DEFAULT_NOTICE,
    },
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
  expect(after.body).toEqual({ profile: defaultProfile });
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

it.each([0, 45, LONGEST_NOTICE])(
  "saves a minimum notice of %i minutes and keeps the rest",
  async (minutes) => {
    const professional = await signUpAgent(app, testProfessional);

    const res = await professional
      .patch(`${API_V1}/settings/profile`)
      .send({ minimumNoticeMinutes: minutes });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ profile: { ...defaultProfile, minimumNoticeMinutes: minutes } });
    const after = await professional.get(`${API_V1}/settings/profile`);
    expect(after.body).toEqual(res.body);
  },
);

it.each([-1, LONGEST_NOTICE + 1, 1.5, "120", null])(
  "refuses a minimum notice of %j and keeps the saved one",
  async (minutes) => {
    const professional = await signUpAgent(app, testProfessional);

    const res = await professional
      .patch(`${API_V1}/settings/profile`)
      .send({ minimumNoticeMinutes: minutes });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: ErrorCode.VALIDATION,
      message: `Minimum notice must be a whole number of minutes from 0 to ${LONGEST_NOTICE}.`,
    });
    const after = await professional.get(`${API_V1}/settings/profile`);
    expect(after.body).toEqual({ profile: defaultProfile });
  },
);

import { afterAll, beforeEach, expect, it } from "vitest";
import { SESSION_MINUTES } from "../src/directory/slots.js";
import { ErrorCode } from "../src/errors.js";
import { API_V1 } from "../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "./app.js";
import { createTestDb } from "./db.js";

const otherProfessional = {
  ...testProfessional,
  name: "Ivo Brandt",
  email: "ivo@example.com",
  timezone: "Europe/London",
};

const MONDAY = 1;
const CLOCK_START = "2027-01-15T09:00:00Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

it("a member sees an empty list when there are no professionals", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ professionals: [] });
});

it("a member sees every professional sorted by name, and no members", async () => {
  await signUpAgent(app, testProfessional);
  await signUpAgent(app, otherProfessional);
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    professionals: [
      {
        id: expect.any(String),
        name: otherProfessional.name,
        title: otherProfessional.title,
        bio: otherProfessional.bio,
        timezone: otherProfessional.timezone,
      },
      {
        id: expect.any(String),
        name: testProfessional.name,
        title: testProfessional.title,
        bio: testProfessional.bio,
        timezone: testProfessional.timezone,
      },
    ],
  });
});

it("a member opens one professional's profile", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    professional: {
      id,
      name: testProfessional.name,
      title: testProfessional.title,
      bio: testProfessional.bio,
      timezone: testProfessional.timezone,
    },
  });
});

it.each([
  { case: "an unknown id", id: "00000000-0000-4000-8000-000000000000" },
  { case: "a malformed id", id: "not-a-uuid" },
])("a profile request with $case returns 404", async ({ id }) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

it("a member sees a professional's free slots for the next 28 days, as start and end only", async () => {
  // 04:00Z is 09:30 in Kolkata, so today's 09:00 slot (03:30Z) has passed.
  clock.set("2027-01-11T04:00:00Z");
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  await professional
    .put(`${API_V1}/settings/hours`)
    .send({ ranges: [{ weekday: MONDAY, start: "09:00", end: "11:00" }] });
  const member = await signUpAgent(app, testMember);
  const starts = [
    "2027-01-11T04:30:00Z",
    "2027-01-18T03:30:00Z",
    "2027-01-18T04:30:00Z",
    "2027-01-25T03:30:00Z",
    "2027-01-25T04:30:00Z",
    "2027-02-01T03:30:00Z",
    "2027-02-01T04:30:00Z",
    // The 04:30Z slot on 8 February would start after the window ends at 04:00Z.
    "2027-02-08T03:30:00Z",
  ];

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    slots: starts.map((start) => ({
      start: new Date(start).toISOString(),
      end: new Date(new Date(start).getTime() + SESSION_MINUTES * 60_000).toISOString(),
    })),
  });
});

it("a professional with no working hours has no slots", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ slots: [] });
});

it.each([
  { case: "an unknown id", id: "00000000-0000-4000-8000-000000000000" },
  { case: "a malformed id", id: "not-a-uuid" },
])("a slots request with $case returns 404", async ({ id }) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}/slots`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

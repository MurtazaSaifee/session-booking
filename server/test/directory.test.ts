import { afterAll, beforeEach, expect, it } from "vitest";
import { API_V1 } from "../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "./app.js";
import { createTestDb } from "./db.js";

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

import { afterAll, beforeEach, expect, it } from "vitest";
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

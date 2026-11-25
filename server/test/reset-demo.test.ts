import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { API_V1 } from "../src/paths.js";
import { resetDemoDatabase, seedIfEmpty } from "../src/seed.js";
import { createTestApp, resetDb, signUpAgent, testClock, testProfessional } from "./app.js";
import { CLOCK_START } from "./booking/helpers.js";
import { createTestDb } from "./db.js";

const clock = testClock(CLOCK_START);
const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

it("refuses to reset unless ALLOW_DEMO_RESET is true", async () => {
  await seedIfEmpty(db, clock.now());

  await expect(resetDemoDatabase(db, clock.now(), {})).rejects.toThrow("ALLOW_DEMO_RESET");
  await expect(resetDemoDatabase(db, clock.now(), { ALLOW_DEMO_RESET: "false" })).rejects.toThrow(
    "ALLOW_DEMO_RESET",
  );
  expect(await db("users").count()).toEqual([{ count: "6" }]);
});

it("wipes extra users and refreshes seeded sessions when ALLOW_DEMO_RESET is true", async () => {
  await seedIfEmpty(db, clock.now());
  await signUpAgent(app, testProfessional);
  expect(await db("users").count()).toEqual([{ count: "7" }]);

  clock.advanceMinutes(24 * 60);
  await resetDemoDatabase(db, clock.now(), { ALLOW_DEMO_RESET: "true" });

  const users = await db("users").select("email");
  expect(users).toHaveLength(6);
  expect(users.some((u) => u.email === testProfessional.email)).toBe(false);

  const upcoming = await db("sessions").where("starts_at", ">", clock.now()).select("starts_at");
  expect(upcoming).toHaveLength(1);
  expect(new Date(upcoming[0].starts_at).getTime() - clock.now().getTime()).toBe(70 * 60_000);

  // Health check still sees the database after reset.
  const health = await request(app).get(`${API_V1}/health`);
  expect(health.status).toBe(200);
});

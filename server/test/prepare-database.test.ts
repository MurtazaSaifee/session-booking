import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { prepareDatabase } from "../src/prepare-database.js";
import { resetDb } from "./app.js";
import { CLOCK_START } from "./booking/helpers.js";
import { createTestDb } from "./db.js";

const db = createTestDb();
const now = new Date(CLOCK_START);

beforeEach(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  await resetDb(db);
});

afterAll(() => db.destroy());

it("loads demo data when asked for by name", async () => {
  await prepareDatabase(db, now, { NODE_ENV: "production", SEED_DEMO_DATA: "true" });

  expect(await db("users").select("id")).not.toEqual([]);
});

it("leaves production empty otherwise", async () => {
  await prepareDatabase(db, now, { NODE_ENV: "production" });

  expect(await db("users").select("id")).toEqual([]);
});

it("is safe to run on every deploy", async () => {
  const env = { NODE_ENV: "production", SEED_DEMO_DATA: "true" };
  await prepareDatabase(db, now, env);
  const before = await db("users").count();

  await prepareDatabase(db, now, env);

  expect(await db("users").count()).toEqual(before);
});

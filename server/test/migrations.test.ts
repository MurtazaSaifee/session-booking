import { afterAll, expect, it } from "vitest";
import { createDb } from "../src/db.js";
import { migrate, rollback } from "../src/migrate.js";
import { createTestDb, testDatabaseUrl } from "./db.js";

const db = createTestDb();

afterAll(() => db.destroy());

it("rolls back every migration, then migrates up again", async () => {
  await rollback(db, { all: true });
  expect(await db.schema.hasTable("users")).toBe(false);
  expect(await db.schema.hasTable("refresh_tokens")).toBe(false);
  expect(await db.schema.hasTable("working_hours")).toBe(false);
  expect(await db.schema.hasTable("sessions")).toBe(false);

  await migrate(db);
  expect(await db.schema.hasTable("users")).toBe(true);
  expect(await db.schema.hasTable("refresh_tokens")).toBe(true);
  expect(await db.schema.hasTable("working_hours")).toBe(true);
  expect(await db.schema.hasTable("sessions")).toBe(true);
});

it("migrates with a pool of one connection", async () => {
  const single = createDb(testDatabaseUrl, { max: 1 });
  try {
    await rollback(single, { all: true });
    expect(await single.schema.hasTable("users")).toBe(false);
    await migrate(single);
    expect(await single.schema.hasTable("users")).toBe(true);
  } finally {
    await single.destroy();
  }
});

import { afterAll, expect, it } from "vitest";
import { migrate, rollback } from "../src/migrate.js";
import { createTestDb } from "./db.js";

const db = createTestDb();

afterAll(() => db.destroy());

it("rolls back every migration, then migrates up again", async () => {
  await rollback(db, { all: true });
  expect(await db.schema.hasTable("users")).toBe(false);
  expect(await db.schema.hasTable("refresh_tokens")).toBe(false);

  await migrate(db);
  expect(await db.schema.hasTable("users")).toBe(true);
  expect(await db.schema.hasTable("refresh_tokens")).toBe(true);
});

import { readdir, readFile } from "node:fs/promises";
import { afterAll, expect, it } from "vitest";
import { createDb } from "../src/db.js";
import { migrate, rollback } from "../src/migrate.js";
import { Role } from "../src/roles.js";
import { createTestDb, testDatabaseUrl } from "./db.js";

const MIGRATIONS_DIR = new URL("../src/migrations/", import.meta.url);

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

async function runMigrationFile(name: string, file: "up.sql" | "down.sql") {
  await db.raw(await readFile(new URL(`${name}/${file}`, MIGRATIONS_DIR), "utf8"));
}

// Every column, index and constraint. Constraints of one type keep their creation order, because Postgres
// reports the oldest overlap rule broken first and the booking refusals depend on that.
async function schemaShape() {
  const result = await db.raw<{ rows: { item: string }[] }>(`
    select table_name as owner, 1 as part, ordinal_position as position,
      column_name || ' ' || data_type || ' ' || is_nullable as item
    from information_schema.columns
    where table_schema = current_schema() and table_name not like 'knex%'
    union all
    select tablename, 2, 0, indexdef
    from pg_indexes
    where schemaname = current_schema() and tablename not like 'knex%'
    union all
    select t.relname, 3, row_number() over (partition by c.conrelid, c.contype order by c.oid),
      c.conname || ' ' || pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relnamespace = cast(current_schema() as regnamespace) and t.relname not like 'knex%'
    order by owner, part, position, item
  `);
  return result.rows.map((row) => row.item);
}

// Last in this file: a failure here leaves tables the migration history doesn't know about.
it("every up and down file can run twice in a row", async () => {
  const names = (await readdir(MIGRATIONS_DIR)).sort();
  const migrated = await schemaShape();
  await rollback(db, { all: true });

  for (const name of names) {
    await runMigrationFile(name, "up.sql");
    await runMigrationFile(name, "up.sql");
  }
  expect(await schemaShape()).toEqual(migrated);

  const [{ id: professionalId }] = await db("users")
    .insert({
      role: Role.PROFESSIONAL,
      name: "Nora Quill",
      email: "nora@example.com",
      password_hash: "not-a-real-hash",
      timezone: "Asia/Kolkata",
    })
    .returning("id");
  await db("working_hours").insert({
    professional_id: professionalId,
    weekday: 1,
    start_time: "09:00",
    end_time: "12:00",
    deleted_at: new Date(),
  });
  for (const name of names) await runMigrationFile(name, "up.sql");
  expect(await schemaShape()).toEqual(migrated);
  expect(await db("working_hours").select("id")).toHaveLength(1);

  for (const name of names.toReversed()) {
    await runMigrationFile(name, "down.sql");
    await runMigrationFile(name, "down.sql");
  }
  expect(await schemaShape()).toEqual([]);

  await migrate(db);
  expect(await schemaShape()).toEqual(migrated);
});

import pg from "pg";
import { migrate } from "../src/migrate.js";
import { createTestDb, testDatabaseName, testDatabaseUrl } from "./db.js";

export default async function globalSetup(): Promise<void> {
  const name = testDatabaseName(testDatabaseUrl);

  const admin = new URL(testDatabaseUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const exists = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (exists.rowCount === 0) {
      try {
        await client.query(`create database "${name}"`);
      } catch (err) {
        // Two runs can race here. Postgres reports the loser as 42P04, or as 23505 via the pg_database unique index.
        const code = (err as { code?: string }).code;
        if (code !== "42P04" && code !== "23505") throw err;
      }
    }
  } finally {
    await client.end();
  }

  const db = createTestDb();
  try {
    await migrate(db);
  } finally {
    await db.destroy();
  }
}

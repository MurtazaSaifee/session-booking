import { readdir, readFile } from "node:fs/promises";
import type { Db } from "./db.js";

// Any fixed number works, as long as every app instance uses the same one.
const LOCK_ID = 727274;

export async function migrate(db: Db): Promise<void> {
  const dir = new URL("../migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();

  const client = await db.connect();
  try {
    // Holds for the whole run, so two instances starting together can't apply the same file twice.
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    try {
      await client.query(
        "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
      );
      const done = await client.query<{ name: string }>("select name from schema_migrations");
      const applied = new Set(done.rows.map((row) => row.name));

      for (const name of names) {
        if (applied.has(name)) continue;
        const sql = await readFile(new URL(name, dir), "utf8");

        await client.query("begin");
        try {
          await client.query(sql);
          await client.query("insert into schema_migrations (name) values ($1)", [name]);
          await client.query("commit");
        } catch (err) {
          await client.query("rollback");
          throw err;
        }
        console.log(`Applied migration ${name}`);
      }
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_ID]);
    }
  } finally {
    client.release();
  }
}

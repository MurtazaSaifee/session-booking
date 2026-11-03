import { readdir, readFile } from "node:fs/promises";
import type { Knex } from "knex";
import type { Db } from "./db.js";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

// Any fixed number works, as long as every app instance uses the same one.
const MIGRATION_LOCK_ID = 727274;

// Each migration is a folder holding up.sql and down.sql.
async function migrationNames(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function runSqlFile(knex: Knex, name: string, file: string): Promise<void> {
  const sql = await readFile(new URL(`${name}/${file}`, MIGRATIONS_DIR), "utf8");
  await knex.raw(sql);
}

const migrationSource: Knex.MigrationSource<string> = {
  async getMigrations() {
    return migrationNames();
  },
  getMigrationName(name) {
    return name;
  },
  async getMigration(name) {
    return {
      up: (knex) => runSqlFile(knex, name, "up.sql"),
      down: (knex) => runSqlFile(knex, name, "down.sql"),
    };
  },
};

// Knex's own lock throws instead of waiting, and its table creation can race, so one advisory lock serialises both.
// Migrations run inside the lock's transaction, on its one connection, so a small pool can't deadlock.
async function runLocked(db: Db, run: (trx: Knex.Transaction) => Promise<[number, string[]]>): Promise<string[]> {
  let ran: string[] = [];
  await db.transaction(async (trx) => {
    // A second process blocks here, then finds nothing left to run.
    await trx.raw("select pg_advisory_xact_lock(?)", [MIGRATION_LOCK_ID]);
    [, ran] = await run(trx);
  });
  return ran;
}

export function migrate(db: Db): Promise<string[]> {
  return runLocked(db, (trx) => trx.migrate.latest({ migrationSource }));
}

export function rollback(db: Db, { all = false } = {}): Promise<string[]> {
  return runLocked(db, (trx) => trx.migrate.rollback({ migrationSource }, all));
}

import { readdir } from "node:fs/promises";
import type { Knex } from "knex";
import type { Db } from "./db.js";

const MIGRATIONS_DIR = new URL("./migrations/", import.meta.url);

// Any fixed number works, as long as every app instance uses the same one.
const MIGRATION_LOCK_ID = 727274;

// Names have no extension, so dev (.ts) and prod (.js) record the same names.
async function migrationFiles(): Promise<Map<string, string>> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith(".d.ts"))
    .sort();
  return new Map(files.map((file) => [file.replace(/\.(ts|js)$/, ""), file]));
}

const migrationSource: Knex.MigrationSource<string> = {
  async getMigrations() {
    return [...(await migrationFiles()).keys()];
  },
  getMigrationName(name) {
    return name;
  },
  async getMigration(name) {
    const file = (await migrationFiles()).get(name);
    if (!file) throw new Error(`Migration ${name} not found`);
    return import(new URL(file, MIGRATIONS_DIR).href);
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

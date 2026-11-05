import knex, { type Knex } from "knex";

export type Db = Knex;

const DEFAULT_POOL_MAX = 10;

// Each server process holds its own pool, so the database's limit is shared by every running copy. A
// deployment with many copies sets this low enough that together they stay under that limit.
export function parsePoolMax(value: string | undefined): number {
  if (value === undefined) return DEFAULT_POOL_MAX;
  const max = Number(value);
  if (!Number.isInteger(max) || max < 1) throw new Error("DB_POOL_MAX must be a positive whole number");
  return max;
}

// Knex drops idle connections that error, so no pool error listener is needed.
export function createDb(connectionString: string, options: { max?: number } = {}): Db {
  return knex({
    client: "pg",
    connection: { connectionString },
    pool: { min: 0, max: options.max ?? DEFAULT_POOL_MAX },
    acquireConnectionTimeout: 5000,
  });
}

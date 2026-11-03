import knex, { type Knex } from "knex";

export type Db = Knex;

// Knex drops idle connections that error, so no pool error listener is needed.
export function createDb(connectionString: string, options: { max?: number } = {}): Db {
  return knex({
    client: "pg",
    connection: { connectionString },
    pool: { min: 0, max: options.max ?? 10 },
    acquireConnectionTimeout: 5000,
  });
}

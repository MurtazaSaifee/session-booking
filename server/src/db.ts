import pg from "pg";

export type Db = pg.Pool;

export function createDb(connectionString: string, options: pg.PoolConfig = {}): Db {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000, ...options });
  // Without a listener, a dropped idle connection (e.g. Postgres restarting) crashes the process.
  pool.on("error", (err) => console.error("Database connection lost:", err.message));
  return pool;
}

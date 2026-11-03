import { createDb } from "../src/db.js";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://booking:booking@localhost:5433/booking_test";

// Returns the database name. It must be lowercase letters, digits and underscores, ending in _test.
export function testDatabaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to run tests against "${name}". The test database name must be lowercase letters, digits and underscores, ending in _test.`,
    );
  }
  return name;
}

export function createTestDb() {
  return createDb(testDatabaseUrl, { max: 2 });
}

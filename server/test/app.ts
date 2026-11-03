import { createApp } from "../src/app.js";
import type { Db } from "../src/db.js";

export const TEST_JWT_SECRET = "test-secret";

export function testClock(start: string) {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set(iso: string) {
      current = new Date(iso);
    },
    advanceMinutes(minutes: number) {
      current = new Date(current.getTime() + minutes * 60_000);
    },
  };
}

export function createTestApp(db: Db, now: () => Date) {
  return createApp({ db, now, jwtSecret: TEST_JWT_SECRET, secureCookies: false });
}

export async function resetDb(db: Db) {
  await db.raw("truncate users, refresh_tokens cascade");
}

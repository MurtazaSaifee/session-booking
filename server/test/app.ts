import request from "supertest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db.js";
import { API_V1 } from "../src/paths.js";
import { Role } from "../src/roles.js";

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

export const testMember = {
  role: Role.MEMBER,
  name: "Theo Marsh",
  email: "theo@example.com",
  password: "correct horse",
  timezone: "Asia/Singapore",
};

export const testProfessional = {
  role: Role.PROFESSIONAL,
  name: "Nora Quill",
  email: "nora@example.com",
  password: "correct horse",
  timezone: "Asia/Kolkata",
  title: "Counsellor",
  bio: "I help people untangle big decisions.",
};

// The agent keeps the sign-up cookies, so its later requests are signed in.
export async function signUpAgent(
  app: ReturnType<typeof createTestApp>,
  user: typeof testMember | typeof testProfessional,
) {
  const agent = request.agent(app);
  const res = await agent.post(`${API_V1}/auth/signup`).send(user);
  if (res.status !== 201) throw new Error(`Sign-up failed with ${res.status}`);
  return agent;
}

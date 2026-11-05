import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { PAGE_SIZE } from "../../src/paging.js";
import { API_V1 } from "../../src/paths.js";
import { Role } from "../../src/roles.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember } from "../app.js";
import { createTestDb } from "../db.js";

const CLOCK_START = "2027-01-15T09:00:00Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function insertProfessionals(names: string[]) {
  return db("users").insert(
    names.map((name, i) => ({
      role: Role.PROFESSIONAL,
      name,
      email: `professional${i}@example.com`,
      password_hash: "not-a-real-hash",
      timezone: "Asia/Singapore",
    })),
  );
}

it("walks the directory a page at a time, with no one repeated or skipped", async () => {
  const names = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => `Pat ${String(i).padStart(2, "0")}`);
  await insertProfessionals(names);
  const member = await signUpAgent(app, testMember);

  const first = (await member.get(`${API_V1}/professionals`)).body;
  const second = (await member.get(`${API_V1}/professionals`).query({ cursor: first.next })).body;

  expect(first.items).toHaveLength(PAGE_SIZE);
  expect(second.next).toBeNull();
  expect([...first.items, ...second.items].map((row: { name: string }) => row.name)).toEqual(names);
});

it("keeps two professionals with the same name apart across a page edge", async () => {
  await insertProfessionals(Array.from({ length: PAGE_SIZE + 2 }, () => "Pat Same"));
  const member = await signUpAgent(app, testMember);

  const first = (await member.get(`${API_V1}/professionals`)).body;
  const second = (await member.get(`${API_V1}/professionals`).query({ cursor: first.next })).body;
  const ids = [...first.items, ...second.items].map((row: { id: string }) => row.id);

  expect(ids).toHaveLength(PAGE_SIZE + 2);
  expect(new Set(ids).size).toBe(PAGE_SIZE + 2);
});

it("refuses a tampered cursor with a 400", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals`).query({ cursor: "@@@" });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
});

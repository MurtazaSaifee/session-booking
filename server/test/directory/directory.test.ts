import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { PAGE_SIZE } from "../../src/paging.js";
import { API_V1 } from "../../src/paths.js";
import { Role } from "../../src/roles.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";

const otherProfessional = {
  ...testProfessional,
  name: "Ivo Brandt",
  email: "ivo@example.com",
  timezone: "Europe/London",
};

const CLOCK_START = "2027-01-15T09:00:00Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

it("a member sees an empty list when there are no professionals", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ items: [], next: null });
});

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

it("a member sees every professional sorted by name, and no members", async () => {
  await signUpAgent(app, testProfessional);
  await signUpAgent(app, otherProfessional);
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    next: null,
    items: [
      {
        id: expect.any(String),
        name: otherProfessional.name,
        title: otherProfessional.title,
        bio: otherProfessional.bio,
        timezone: otherProfessional.timezone,
      },
      {
        id: expect.any(String),
        name: testProfessional.name,
        title: testProfessional.title,
        bio: testProfessional.bio,
        timezone: testProfessional.timezone,
      },
    ],
  });
});

it("a member opens one professional's profile", async () => {
  const professional = await signUpAgent(app, testProfessional);
  const { id } = (await professional.get(`${API_V1}/auth/me`)).body.user;
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    professional: {
      id,
      name: testProfessional.name,
      title: testProfessional.title,
      bio: testProfessional.bio,
      timezone: testProfessional.timezone,
    },
  });
});

it.each([
  { case: "an unknown id", id: "00000000-0000-4000-8000-000000000000" },
  { case: "a malformed id", id: "not-a-uuid" },
])("a profile request with $case returns 404", async ({ id }) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${API_V1}/professionals/${id}`);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "We couldn't find that professional." });
});

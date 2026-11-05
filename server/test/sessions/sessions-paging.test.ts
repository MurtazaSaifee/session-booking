import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { PAGE_SIZE, encodeCursor } from "../../src/paging.js";
import { API_V1 } from "../../src/paths.js";
import { SessionList } from "../../src/sessions/session-list.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  SESSIONS_URL,
  type Agent,
  book,
  markCancelled,
  signUpProfessional,
  userId,
} from "./helpers.js";

// 24 slots: the next three Mondays with 09:00-17:00 hours in Kolkata.
const KOLKATA_STARTS = ["2027-01-18", "2027-01-25", "2027-02-01"].flatMap((day) =>
  ["03:30", "04:30", "05:30", "06:30", "07:30", "08:30", "09:30", "10:30"].map(
    (time) => `${day}T${time}:00.000Z`,
  ),
);

const ID = "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

type Row = { id: string; start: string };

function nextPage(agent: Agent, list: SessionList, cursor: string) {
  return agent.get(SESSIONS_URL).query({ list, cursor });
}

async function setUp() {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  for (const start of KOLKATA_STARTS) await book(member, professional.id, start);
  return { professional, member };
}

async function logIn(member: Agent) {
  await member.post(`${API_V1}/auth/login`).send({ email: testMember.email, password: testMember.password });
}

it("walks upcoming soonest first, with no row repeated or skipped", async () => {
  const { member } = await setUp();

  const first = (await member.get(SESSIONS_URL)).body.upcoming;
  const second = (await nextPage(member, SessionList.UPCOMING, first.next)).body;

  expect(first.items).toHaveLength(PAGE_SIZE);
  expect(second.next).toBeNull();
  expect([...first.items, ...second.items].map((row: Row) => row.start)).toEqual(KOLKATA_STARTS);
});

it("walks past most recent first", async () => {
  const { member } = await setUp();
  clock.set("2027-02-02T00:00:00Z");
  await logIn(member);

  const first = (await member.get(SESSIONS_URL)).body.past;
  const second = (await nextPage(member, SessionList.PAST, first.next)).body;

  expect([...first.items, ...second.items].map((row: Row) => row.start)).toEqual(
    [...KOLKATA_STARTS].reverse(),
  );
});

it("a session moving into past while someone pages doesn't repeat or skip a row", async () => {
  const { member } = await setUp();
  // 22 of the 24 have ended, so the first page of past stops two short of the oldest.
  clock.set("2027-02-01T09:25:00Z");
  await logIn(member);
  const first = (await member.get(SESSIONS_URL)).body.past;

  // Two more end while the first page is on screen, which pushes every older row down by two.
  clock.set("2027-02-02T00:00:00Z");
  await logIn(member);
  const second = (await nextPage(member, SessionList.PAST, first.next)).body;

  expect(first.items).toHaveLength(PAGE_SIZE);
  expect(second.items.map((row: Row) => row.start)).toEqual([KOLKATA_STARTS[1], KOLKATA_STARTS[0]]);
});

it("two cancelled sessions at the same time, split by a page edge, both appear once", async () => {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "10:00");
  const member = await signUpAgent(app, testMember);
  const memberId = await userId(member);
  const ids: string[] = [];
  for (let i = 0; i < PAGE_SIZE + 2; i += 1) {
    const { id } = (await book(member, professional.id, KOLKATA_FIRST)).body.session;
    await markCancelled(db, id, memberId, CLOCK_START);
    ids.push(id);
  }

  const first = (await member.get(SESSIONS_URL)).body.cancelled;
  const second = (await nextPage(member, SessionList.CANCELLED, first.next)).body;
  const seen = [...first.items, ...second.items].map((row: Row) => row.id);

  expect(seen).toHaveLength(ids.length);
  expect(new Set(seen)).toEqual(new Set(ids));
});

it.each([
  ["a list that doesn't exist", { list: "ARCHIVE", cursor: "abc" }],
  ["a list with no cursor", { list: SessionList.PAST }],
  ["a cursor with no list", { cursor: "abc" }],
  ["a tampered cursor", { list: SessionList.PAST, cursor: "@@@" }],
  [
    "a cursor with a date Postgres can't read",
    { list: SessionList.PAST, cursor: encodeCursor({ value: "0000-01-01T00:00:00.000Z", id: ID }) },
  ],
])("refuses %s with a 400", async (_name, query) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(SESSIONS_URL).query(query);

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
});

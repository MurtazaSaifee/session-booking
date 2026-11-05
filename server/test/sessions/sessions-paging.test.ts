import { afterAll, beforeEach, expect, it } from "vitest";
import { PAGE_SIZE } from "../../src/paging.js";
import { SessionList } from "../../src/sessions/session-list.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_STARTS,
  SESSIONS_URL,
  type Agent,
  book,
  logIn,
  markCancelled,
  signUpProfessional,
  userId,
} from "../booking/helpers.js";

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
  return agent.get(`${SESSIONS_URL}/lists/${list}`).query({ cursor });
}

async function setUp() {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  for (const start of KOLKATA_STARTS) await book(member, professional.id, start);
  return { professional, member };
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
  await logIn(member, testMember);

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
  await logIn(member, testMember);
  const first = (await member.get(SESSIONS_URL)).body.past;

  // Two more end while the first page is on screen, which pushes every older row down by two.
  clock.set("2027-02-02T00:00:00Z");
  await logIn(member, testMember);
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

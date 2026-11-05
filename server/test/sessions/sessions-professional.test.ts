import { afterAll, beforeEach, expect, it } from "vitest";
import { SessionList } from "../../src/sessions/session-list.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_STARTS,
  SESSIONS_URL,
  book,
  logIn,
  signUpProfessional,
} from "../booking/helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

type Row = { start: string; otherPersonName: string };

it("walks a professional's past most recent first, naming the member on every row", async () => {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "17:00");
  const member = await signUpAgent(app, testMember);
  for (const start of KOLKATA_STARTS) await book(member, professional.id, start);
  clock.set("2027-02-02T00:00:00Z");
  await logIn(professional.agent, testProfessional);

  const first = (await professional.agent.get(SESSIONS_URL)).body.past;
  const second = (
    await professional.agent.get(`${SESSIONS_URL}/lists/${SessionList.PAST}`).query({ cursor: first.next })
  ).body;
  const rows: Row[] = [...first.items, ...second.items];

  expect(second.next).toBeNull();
  expect(rows.map((row) => row.start)).toEqual([...KOLKATA_STARTS].reverse());
  expect(new Set(rows.map((row) => row.otherPersonName))).toEqual(new Set([testMember.name]));
});

import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { encodeCursor } from "../../src/paging.js";
import { SessionList } from "../../src/sessions/session-list.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember } from "../app.js";
import { createTestDb } from "../db.js";
import { CLOCK_START, SESSIONS_URL } from "../booking/helpers.js";

const ID = "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

it.each([
  ["a list that doesn't exist", "ARCHIVE", { cursor: "abc" }],
  ["a list with no cursor", SessionList.PAST, {}],
  ["a tampered cursor", SessionList.PAST, { cursor: "@@@" }],
  [
    "a cursor with a date Postgres can't read",
    SessionList.PAST,
    { cursor: encodeCursor({ value: "0000-01-01T00:00:00.000Z", id: ID }) },
  ],
])("refuses %s with a 400", async (_name, list, query) => {
  const member = await signUpAgent(app, testMember);

  const res = await member.get(`${SESSIONS_URL}/lists/${list}`).query(query);

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
});

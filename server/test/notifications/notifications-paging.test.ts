import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { PAGE_SIZE, encodeCursor } from "../../src/paging.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { NOTIFICATIONS_URL, bookOneSession } from "../reminders/helpers.js";
import { giveNotifications } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

const SAME_TIME = "2027-01-12T00:00:00.000Z";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function minutesAfter(start: string, count: number) {
  return Array.from({ length: count }, (_, minute) =>
    new Date(new Date(start).getTime() + minute * 60_000).toISOString(),
  );
}

it("exactly one full page has no next page", async () => {
  const { member, memberId, sessionId } = await bookOneSession(app);
  await giveNotifications(db, sessionId, memberId, minutesAfter(SAME_TIME, PAGE_SIZE));

  const res = await member.get(NOTIFICATIONS_URL);

  expect(res.body.items).toHaveLength(PAGE_SIZE);
  expect(res.body.next).toBeNull();
});

it.each([
  { case: "different times", times: minutesAfter(SAME_TIME, 45) },
  { case: "the same time, as one checker run gives", times: Array<string>(45).fill(SAME_TIME) },
])("pages through rows at $case without repeating or losing one", async ({ times }) => {
  const { member, memberId, sessionId } = await bookOneSession(app);
  await giveNotifications(db, sessionId, memberId, times);

  const first = await member.get(NOTIFICATIONS_URL);
  const second = await member.get(NOTIFICATIONS_URL).query({ cursor: first.body.next });
  const third = await member.get(NOTIFICATIONS_URL).query({ cursor: second.body.next });

  expect(first.body.items).toHaveLength(PAGE_SIZE);
  expect(second.body.items).toHaveLength(PAGE_SIZE);
  expect(third.body.items).toHaveLength(5);
  expect(third.body.next).toBeNull();
  const ids = [first, second, third].flatMap((page) =>
    (page.body.items as { id: string }[]).map((item) => item.id),
  );
  expect(new Set(ids).size).toBe(45);
  expect(third.body.unreadCount).toBe(45);
});

it("a page past the end still carries the unread count", async () => {
  const { member, memberId, sessionId } = await bookOneSession(app);
  await giveNotifications(db, sessionId, memberId, [SAME_TIME]);
  const beforeEverything = encodeCursor({
    value: "2020-01-01T00:00:00.000Z",
    id: "00000000-0000-4000-8000-000000000000",
  });

  const res = await member.get(NOTIFICATIONS_URL).query({ cursor: beforeEverything });

  expect(res.body).toEqual({ items: [], next: null, unreadCount: 1 });
});

it.each([
  { case: "not a cursor", cursor: "abc" },
  { case: "a repeated cursor", cursor: ["abc", "def"] },
  { case: "a bad date", cursor: encodeCursor({ value: "soon", id: "00000000-0000-4000-8000-000000000000" }) },
  { case: "a bad id", cursor: encodeCursor({ value: SAME_TIME, id: "nope" }) },
])("refuses $case with 400", async ({ cursor }) => {
  const { member } = await bookOneSession(app);

  const res = await member.get(NOTIFICATIONS_URL).query({ cursor });

  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
});

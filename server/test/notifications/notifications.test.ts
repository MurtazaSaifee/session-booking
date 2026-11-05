import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { PAGE_SIZE, encodeCursor } from "../../src/paging.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import {
  DAY_BEFORE_DUE,
  HOUR_BEFORE_DUE,
  MEMBER_READS,
  NOTIFICATIONS_URL,
  bookOneSession,
} from "../reminders/helpers.js";
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

it("an empty list has no items, no next page and nothing unread", async () => {
  const { member } = await bookOneSession(app);

  const res = await member.get(NOTIFICATIONS_URL);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ items: [], next: null, unreadCount: 0 });
});

it("lists delivered reminders, newest first, with the unread count", async () => {
  const { member, sessionId } = await bookOneSession(app);
  await deliverDueReminders(db, new Date(DAY_BEFORE_DUE));
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  const res = await member.get(NOTIFICATIONS_URL);

  expect(res.body).toEqual({
    items: [
      {
        id: expect.any(String),
        sessionId,
        text: MEMBER_READS,
        createdAt: new Date(HOUR_BEFORE_DUE).toISOString(),
      },
      {
        id: expect.any(String),
        sessionId,
        text: MEMBER_READS,
        createdAt: new Date(DAY_BEFORE_DUE).toISOString(),
      },
    ],
    next: null,
    unreadCount: 2,
  });
});

it("mark all read clears the count and keeps the notifications", async () => {
  const { member } = await bookOneSession(app);
  await deliverDueReminders(db, new Date(DAY_BEFORE_DUE));

  const marked = await member.post(`${NOTIFICATIONS_URL}/read`).send({});

  expect(marked.status).toBe(204);
  const res = await member.get(NOTIFICATIONS_URL);
  expect(res.body.unreadCount).toBe(0);
  expect(res.body.items).toHaveLength(1);
});

it("a reminder delivered after mark all read counts as unread", async () => {
  const { member } = await bookOneSession(app);
  await deliverDueReminders(db, new Date(DAY_BEFORE_DUE));
  await member.post(`${NOTIFICATIONS_URL}/read`).send({});

  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  expect((await member.get(NOTIFICATIONS_URL)).body.unreadCount).toBe(1);
});

it("the unread count alone follows delivery and mark all read", async () => {
  const { member } = await bookOneSession(app);
  const unreadCount = async () => (await member.get(`${NOTIFICATIONS_URL}/unread-count`)).body;
  expect(await unreadCount()).toEqual({ unreadCount: 0 });

  await deliverDueReminders(db, new Date(DAY_BEFORE_DUE));
  expect(await unreadCount()).toEqual({ unreadCount: 1 });

  await member.post(`${NOTIFICATIONS_URL}/read`).send({});
  expect(await unreadCount()).toEqual({ unreadCount: 0 });
});

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

import { afterAll, beforeEach, expect, it } from "vitest";
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

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

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

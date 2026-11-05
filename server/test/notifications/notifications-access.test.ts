import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { encodeCursor } from "../../src/paging.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, signUpAgent, testClock } from "../app.js";
import { CLOCK_START, otherMember } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import {
  DAY_BEFORE_DUE,
  MEMBER_READS,
  NOTIFICATIONS_URL,
  bookOneSession,
  textsFor,
} from "../reminders/helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

async function aDeliveredReminderAndAStranger() {
  const people = await bookOneSession(app);
  const stranger = await signUpAgent(app, otherMember);
  await deliverDueReminders(db, new Date(DAY_BEFORE_DUE));
  return { ...people, stranger };
}

it("reading the list needs a sign-in", async () => {
  const res = await request(app).get(NOTIFICATIONS_URL);

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("reading the unread count needs a sign-in", async () => {
  const res = await request(app).get(`${NOTIFICATIONS_URL}/unread-count`);

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("the unread count covers only the person asking", async () => {
  const { member, stranger, memberId } = await aDeliveredReminderAndAStranger();

  const mine = await member.get(`${NOTIFICATIONS_URL}/unread-count`);
  const theirs = await stranger.get(`${NOTIFICATIONS_URL}/unread-count`).query({ recipientId: memberId });

  expect(mine.body.unreadCount).toBe(1);
  expect(theirs.body.unreadCount).toBe(0);
});

it("marking all read needs a sign-in", async () => {
  const res = await request(app).post(`${NOTIFICATIONS_URL}/read`).send({});

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("each person sees only their own notifications", async () => {
  const { member, professional, stranger } = await aDeliveredReminderAndAStranger();

  expect(await textsFor(member)).toEqual([MEMBER_READS]);
  expect(await textsFor(professional)).toHaveLength(1);
  expect(await textsFor(professional)).not.toContain(MEMBER_READS);
  expect((await stranger.get(NOTIFICATIONS_URL)).body).toEqual({ items: [], next: null, unreadCount: 0 });
});

it("marking all read leaves other people's notifications unread", async () => {
  const { member, professional, stranger } = await aDeliveredReminderAndAStranger();

  await stranger.post(`${NOTIFICATIONS_URL}/read`).send({});
  await member.post(`${NOTIFICATIONS_URL}/read`).send({});

  expect((await professional.get(NOTIFICATIONS_URL)).body.unreadCount).toBe(1);
});

it("a hand-made cursor can't reach another person's notifications", async () => {
  const { member, stranger } = await aDeliveredReminderAndAStranger();
  const [{ id }] = (await member.get(NOTIFICATIONS_URL)).body.items;
  const afterEverything = encodeCursor({ value: "2099-01-01T00:00:00.000Z", id });

  const res = await stranger.get(NOTIFICATIONS_URL).query({ cursor: afterEverything });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ items: [], next: null, unreadCount: 0 });
});

it("ignores a person id in the request: only the sign-in decides whose notifications these are", async () => {
  const { memberId, member, stranger } = await aDeliveredReminderAndAStranger();

  const list = await stranger.get(NOTIFICATIONS_URL).query({ recipientId: memberId });
  await stranger.post(`${NOTIFICATIONS_URL}/read`).send({ recipientId: memberId });

  expect(list.body.items).toEqual([]);
  expect((await member.get(NOTIFICATIONS_URL)).body.unreadCount).toBe(1);
});

import { afterAll, beforeEach, expect, it } from "vitest";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, signUpAgent, testClock } from "../app.js";
import { CLOCK_START, book, otherMember } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { DAY_BEFORE_DUE, HOUR_BEFORE_DUE, SESSION_START, bookOneSession, textsFor } from "./helpers.js";

const JUST_BEFORE_START = "2027-01-18T03:29:59Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function checkAt(iso: string | number) {
  return deliverDueReminders(db, new Date(iso));
}

it("plans each person a reminder 24 hours before and another 1 hour before", async () => {
  const { member, professional } = await bookOneSession(app);
  const counts = async () => [(await textsFor(member)).length, (await textsFor(professional)).length];

  await checkAt(new Date(DAY_BEFORE_DUE).getTime() - 1);
  expect(await counts()).toEqual([0, 0]);

  await checkAt(DAY_BEFORE_DUE);
  expect(await counts()).toEqual([1, 1]);

  await checkAt(new Date(HOUR_BEFORE_DUE).getTime() - 1);
  expect(await counts()).toEqual([1, 1]);

  await checkAt(HOUR_BEFORE_DUE);
  expect(await counts()).toEqual([2, 2]);
});

it.each([
  { case: "a little over 24 hours before", now: "2027-01-17T03:29:59Z", each: 2 },
  { case: "exactly 24 hours before", now: DAY_BEFORE_DUE, each: 1 },
  { case: "inside 24 hours", now: "2027-01-17T04:00:00Z", each: 1 },
  { case: "exactly 1 hour before", now: HOUR_BEFORE_DUE, each: 0 },
  { case: "inside 1 hour", now: "2027-01-18T03:00:00Z", each: 0 },
])("booked $case, each person only gets reminders still in the future", async ({ now, each }) => {
  clock.set(now);
  // No notice, so a booking can land inside the last hour.
  const { member, professional } = await bookOneSession(app, 0);

  await checkAt(JUST_BEFORE_START);

  expect(await textsFor(member)).toHaveLength(each);
  expect(await textsFor(professional)).toHaveLength(each);
});

it("a booking the database refuses leaves no reminders behind", async () => {
  const { member, professionalId } = await bookOneSession(app);
  const refused = await signUpAgent(app, otherMember);

  const res = await book(refused, professionalId, SESSION_START);
  await checkAt(JUST_BEFORE_START);

  expect(res.status).toBe(409);
  expect(await textsFor(refused)).toEqual([]);
  expect(await textsFor(member)).toHaveLength(2);
});

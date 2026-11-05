import { afterAll, beforeEach, expect, it } from "vitest";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { HOUR_BEFORE_DUE, bookOneSession, textsFor } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

it.each([
  { case: "several batches", batchSize: 1 },
  { case: "a part-filled last batch", batchSize: 3 },
  { case: "an exactly filled batch", batchSize: 4 },
])("delivers everything due across $case", async ({ batchSize }) => {
  const { member, professional } = await bookOneSession(app);

  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE), batchSize);

  expect(await textsFor(member)).toHaveLength(2);
  expect(await textsFor(professional)).toHaveLength(2);
});

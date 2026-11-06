import { afterAll, beforeEach, expect, it } from "vitest";
import { moveSession } from "../../src/sessions/store.js";
import { sessionEnd } from "../../src/slots/slots.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { CLOCK_START, KOLKATA_FIRST, KOLKATA_SECOND, SESSIONS_URL } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { bookOneSession, textsFor } from "../reminders/helpers.js";
import { reschedule } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

// The version is storage the API never shows, and this guarantee is about storage itself.
async function versionOf(sessionId: string): Promise<number> {
  return (await db("sessions").where({ id: sessionId }).first("version")).version;
}

it("a move built on an old read is dropped even when the session has come back to the same start", async () => {
  const { member, professional, sessionId, professionalId } = await bookOneSession(app);
  const versionRead = await versionOf(sessionId);
  await reschedule(member, sessionId, KOLKATA_SECOND);
  await reschedule(member, sessionId, KOLKATA_FIRST);
  const start = new Date("2027-01-18T05:30:00Z");

  const moved = await moveSession(db, {
    id: sessionId,
    version: versionRead,
    start,
    end: sessionEnd(start),
    recipientId: professionalId,
    text: "Should never be sent",
    now: clock.now(),
  });

  expect(moved).toBe(false);
  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { id: sessionId, start: "2027-01-18T03:30:00.000Z" },
  ]);
  expect((await textsFor(professional)).filter((text) => text.includes("Should never"))).toEqual([]);
});

import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../../src/db.js";
import { ErrorCode } from "../../src/errors.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember } from "../app.js";
import { CLOCK_START, KOLKATA_SECOND, SESSIONS_URL, book, otherMember } from "../booking/helpers.js";
import { testDatabaseUrl } from "../db.js";
import {
  HOUR_BEFORE_DUE,
  MEMBER_READS,
  PROFESSIONAL_READS,
  bookOneSession,
  textsFor,
} from "../reminders/helpers.js";
import { holdSave, reschedule, waitUntilStuck, withTrigger } from "./helpers.js";

// One connection each for the hold, the move, the other booking, and watching them wait.
const db = createDb(testDatabaseUrl, { max: 4 });
const app = createTestApp(db, testClock(CLOCK_START).now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

type Booked = Awaited<ReturnType<typeof bookOneSession>>;

// The session, its reminders and both people's notifications read as they did after booking.
async function expectNothingChanged({ member, professional }: Booked) {
  const { upcoming, cancelled } = (await member.get(SESSIONS_URL)).body;
  expect(upcoming.items).toMatchObject([{ start: "2027-01-18T03:30:00.000Z" }]);
  expect(cancelled.items).toEqual([]);
  expect(await textsFor(professional)).toEqual([]);

  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
  expect(await textsFor(member)).toEqual([MEMBER_READS, MEMBER_READS]);
  // Anything about Theo: another member's own reminders may also have come due for the professional.
  const aboutTheo = (await textsFor(professional)).filter((text) => text.includes(testMember.name));
  expect(aboutTheo).toEqual([PROFESSIONAL_READS, PROFESSIONAL_READS]);
}

async function bookForSomeoneElse(booked: Booked) {
  const iris = await signUpAgent(app, otherMember);
  const res = await book(iris, booked.professionalId, KOLKATA_SECOND);
  expect(res.status).toBe(201);
}

it("a time someone else already booked gives SLOT_TAKEN and changes nothing", async () => {
  const booked = await bookOneSession(app);
  await bookForSomeoneElse(booked);

  const res = await reschedule(booked.member, booked.sessionId, KOLKATA_SECOND);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.SLOT_TAKEN);
  await expectNothingChanged(booked);
});

it("a time taken after the check but before the move gives SLOT_TAKEN and changes nothing", async () => {
  const booked = await bookOneSession(app);
  const moveStops = {
    table: "sessions",
    event: "update",
    when: "new.starts_at = '2027-01-18T04:30:00Z'",
    atRow: 1,
  };

  let status = 0;
  let error = "";
  await holdSave(db, moveStops, async (release) => {
    const move = Promise.resolve(reschedule(booked.member, booked.sessionId, KOLKATA_SECOND));
    await waitUntilStuck(db, "dropped_reminders");
    await bookForSomeoneElse(booked);
    await release();
    const res = await move;
    status = res.status;
    error = res.body.error;
  });

  expect(status).toBe(409);
  expect(error).toBe(ErrorCode.SLOT_TAKEN);
  await expectNothingChanged(booked);
});

it("a move that fails at its last step leaves the session, reminders and notices as they were", async () => {
  const booked = await bookOneSession(app);
  const body = "raise exception 'the notice failed';";

  let status = 0;
  await withTrigger(
    db,
    { table: "notifications", event: "insert", when: "new.reminder_id is null", body },
    async () => {
      status = (await reschedule(booked.member, booked.sessionId, KOLKATA_SECOND)).status;
    },
  );

  expect(status).toBe(500);
  await expectNothingChanged(booked);
});

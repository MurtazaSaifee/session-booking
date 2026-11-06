import { afterAll, beforeEach, expect, it } from "vitest";
import { createDb } from "../../src/db.js";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { testDatabaseUrl } from "../db.js";
import {
  DAY_BEFORE_DUE,
  HOUR_BEFORE_DUE,
  MEMBER_READS,
  PROFESSIONAL_READS,
  bookOneSession,
  textsFor,
} from "../reminders/helpers.js";
import { holdSave, reschedule, startCancel, waitUntilStuck } from "../sessions/helpers.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  KOLKATA_SECOND,
  KOLKATA_STARTS,
  SESSIONS_URL,
  book,
  logIn,
  otherMember,
  signUpProfessional,
  type Agent,
} from "./helpers.js";

// One connection each for the hold, the two sides of a race, and watching them wait.
const db = createDb(testDatabaseUrl, { max: 5 });
const clock = testClock(CLOCK_START);
const app = createTestApp(db, clock.now);

const LONGEST_NOTICE = 28 * 24 * 60;
// Set a week before the session, this puts the earliest allowed start after it but before the next Monday.
const EIGHT_DAYS = 8 * 24 * 60;
const NEXT_WEEK = KOLKATA_STARTS[8];
const JUST_BEFORE_NEXT_WEEK = "2027-01-25T03:29:59Z";
const SECOND_SLOT_HOUR_BEFORE = "2027-01-18T03:30:00Z";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function setNotice(professional: Agent, minimumNoticeMinutes: number) {
  return professional.patch(`${API_V1}/settings/profile`).send({ minimumNoticeMinutes });
}

async function upcomingStarts(member: Agent) {
  const { upcoming } = (await member.get(SESSIONS_URL)).body;
  return upcoming.items.map((session: { start: string }) => session.start);
}

function checkAt(iso: string) {
  return deliverDueReminders(db, new Date(iso));
}

it("raising the notice leaves a booked session and its reminders as they were", async () => {
  const { member, professional } = await bookOneSession(app);

  expect((await setNotice(professional, LONGEST_NOTICE)).status).toBe(200);
  await checkAt(HOUR_BEFORE_DUE);

  expect(await upcomingStarts(member)).toEqual([new Date(KOLKATA_FIRST).toISOString()]);
  expect(await textsFor(member)).toEqual([MEMBER_READS, MEMBER_READS]);
  expect(await textsFor(professional)).toEqual([PROFESSIONAL_READS, PROFESSIONAL_READS]);
});

it("a session now inside a raised notice can still be cancelled, and its reminders go", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await setNotice(professional, LONGEST_NOTICE);

  expect((await startCancel(member, sessionId)).status).toBe(204);
  await checkAt(HOUR_BEFORE_DUE);

  expect(await upcomingStarts(member)).toEqual([]);
  expect(await textsFor(member)).toEqual([]);
  expect(await textsFor(professional)).toHaveLength(1);
});

it("a session now inside a raised notice can move out of it, but not to another time inside it", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await setNotice(professional, EIGHT_DAYS);

  const inside = await reschedule(member, sessionId, KOLKATA_SECOND);
  expect(inside.status).toBe(422);
  expect(inside.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);
  expect(await upcomingStarts(member)).toEqual([new Date(KOLKATA_FIRST).toISOString()]);
  expect(await textsFor(professional)).toEqual([]);

  const outside = await reschedule(member, sessionId, NEXT_WEEK);
  expect(outside.status).toBe(204);
  expect(await upcomingStarts(member)).toEqual([NEXT_WEEK]);
});

it("a move refused by the notice keeps the old reminders and sends no notice", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await setNotice(professional, EIGHT_DAYS);

  await reschedule(member, sessionId, KOLKATA_SECOND);
  await checkAt(HOUR_BEFORE_DUE);

  expect(await textsFor(member)).toEqual([MEMBER_READS, MEMBER_READS]);
  expect(await textsFor(professional)).toEqual([PROFESSIONAL_READS, PROFESSIONAL_READS]);
});

it("a move to exactly the notice replaces the reminders, without one already overdue", async () => {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  const booked = await book(member, professional.id, NEXT_WEEK);
  clock.set("2027-01-18T01:30:00Z");
  await logIn(member, testMember);
  await logIn(professional.agent, testProfessional);

  const res = await reschedule(member, booked.body.session.id, KOLKATA_FIRST);
  await checkAt(HOUR_BEFORE_DUE);
  await checkAt(JUST_BEFORE_NEXT_WEEK);

  expect(res.status).toBe(204);
  expect(await textsFor(member)).toEqual([MEMBER_READS]);
  const professionalTexts = await textsFor(professional.agent);
  expect(professionalTexts.filter((text) => text.includes("moved your session"))).toHaveLength(1);
  expect(professionalTexts.filter((text) => text === PROFESSIONAL_READS)).toHaveLength(1);
});

it("having no notice doesn't get a member round the 24-hour rule", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await setNotice(professional, 0);
  clock.set(new Date(new Date(DAY_BEFORE_DUE).getTime() + 1).toISOString());
  await logIn(member, testMember);

  const res = await reschedule(member, sessionId, KOLKATA_SECOND);

  expect(res.status).toBe(409);
  expect(res.body.error).toBe(ErrorCode.TOO_LATE_TO_CHANGE);
  expect(await upcomingStarts(member)).toEqual([new Date(KOLKATA_FIRST).toISOString()]);
});

it("lowering the notice offers a slot again, and booking it plans only reminders still ahead", async () => {
  clock.set("2027-01-18T02:00:00Z");
  const professional = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);

  const refused = await book(member, professional.id, KOLKATA_FIRST);
  expect(refused.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);

  await setNotice(professional.agent, 30);
  const booked = await book(member, professional.id, KOLKATA_FIRST);
  await checkAt(HOUR_BEFORE_DUE);

  expect(booked.status).toBe(201);
  expect(await textsFor(member)).toEqual([MEMBER_READS]);
});

it("a booking already past its check when the notice rises still saves whole, and the next is refused", async () => {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const member = await signUpAgent(app, testMember);
  const next = await signUpAgent(app, otherMember);
  const firstInsert = { table: "sessions", event: "insert", when: "true", atRow: 1 };

  await holdSave(db, firstInsert, async (release) => {
    const booking = Promise.resolve(book(member, professional.id, KOLKATA_FIRST));
    await waitUntilStuck(db, "new_session");
    expect((await setNotice(professional.agent, LONGEST_NOTICE)).status).toBe(200);
    await release();
    expect((await booking).status).toBe(201);
  });
  const refused = await book(next, professional.id, KOLKATA_SECOND);
  await checkAt(HOUR_BEFORE_DUE);

  expect(refused.status).toBe(422);
  expect(refused.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);
  expect(await textsFor(member)).toEqual([MEMBER_READS, MEMBER_READS]);
});

it("a move already past its check when the notice rises still saves whole", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  const moveOnSession = {
    table: "sessions",
    event: "update",
    when: "new.starts_at is distinct from old.starts_at",
    atRow: 1,
  };

  await holdSave(db, moveOnSession, async (release) => {
    const move = Promise.resolve(reschedule(member, sessionId, KOLKATA_SECOND));
    await waitUntilStuck(db, "dropped_reminders");
    expect((await setNotice(professional, LONGEST_NOTICE)).status).toBe(200);
    await release();
    expect((await move).status).toBe(204);
  });
  await checkAt(SECOND_SLOT_HOUR_BEFORE);

  expect(await upcomingStarts(member)).toEqual([new Date(KOLKATA_SECOND).toISOString()]);
  const reminders = (await textsFor(member)).filter((text) => text.startsWith("Your session with"));
  expect(reminders).toHaveLength(2);
  expect(reminders).not.toContain(MEMBER_READS);
});

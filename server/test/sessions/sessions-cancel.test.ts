import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { API_V1 } from "../../src/paths.js";
import { deliverDueReminders } from "../../src/reminders/deliver.js";
import { CancelledBy } from "../../src/sessions/my-session.js";
import { createTestApp, resetDb, testClock, testMember, testProfessional } from "../app.js";
import { CLOCK_START, SESSIONS_URL, book, logIn } from "../booking/helpers.js";
import { createTestDb } from "../db.js";
import { HOUR_BEFORE_DUE, SESSION_START, bookOneSession, textsFor } from "../reminders/helpers.js";
import { withTrigger } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

const CANCEL_NOTICE = "Nora Quill cancelled your session on Mon 18 Jan at 11:30am";

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function cancelUrl(sessionId: string) {
  return `${SESSIONS_URL}/${sessionId}/cancel`;
}

it("a professional's cancel moves the session to cancelled on both screens and tells the member", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);

  const res = await professional.post(cancelUrl(sessionId)).send({});

  expect(res.status).toBe(204);
  const memberList = (await member.get(SESSIONS_URL)).body;
  expect(memberList.upcoming.items).toEqual([]);
  expect(memberList.cancelled.items).toMatchObject([
    { id: sessionId, cancelledBy: CancelledBy.OTHER_PERSON },
  ]);
  const professionalList = (await professional.get(SESSIONS_URL)).body;
  expect(professionalList.cancelled.items).toMatchObject([{ id: sessionId, cancelledBy: CancelledBy.YOU }]);
  expect(await textsFor(member)).toEqual([CANCEL_NOTICE]);
  expect(await textsFor(professional)).toEqual([]);
});

it("the cancelled time is a free slot again, and can be booked", async () => {
  const { member, professional, professionalId, sessionId } = await bookOneSession(app);
  const freeStarts = async () =>
    (
      (await member.get(`${API_V1}/professionals/${professionalId}/slots`)).body.slots as { start: string }[]
    ).map((slot) => new Date(slot.start).toISOString());
  expect(await freeStarts()).not.toContain(new Date(SESSION_START).toISOString());

  await professional.post(cancelUrl(sessionId)).send({});

  expect(await freeStarts()).toContain(new Date(SESSION_START).toISOString());
  expect((await book(member, professionalId, SESSION_START)).status).toBe(201);
});

it.each([
  ["in progress", "2027-01-18T03:40:00Z"],
  ["already ended", "2027-01-18T05:00:00Z"],
])("a professional can cancel a session that is %s", async (_name, time) => {
  const { member, professional, sessionId } = await bookOneSession(app);
  clock.set(time);
  await logIn(professional, testProfessional);
  await logIn(member, testMember);

  const res = await professional.post(cancelUrl(sessionId)).send({});

  expect(res.status).toBe(204);
  expect(await textsFor(member)).toEqual([CANCEL_NOTICE]);
});

it("reminders for a cancelled session are never delivered", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await professional.post(cancelUrl(sessionId)).send({});

  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));

  expect(await textsFor(member)).toEqual([CANCEL_NOTICE]);
  expect(await textsFor(professional)).toEqual([]);
});

it("cancelling a cancelled session again changes nothing and tells no one twice", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  await professional.post(cancelUrl(sessionId)).send({});

  const res = await professional.post(cancelUrl(sessionId)).send({});

  expect(res.status).toBe(204);
  expect(await textsFor(member)).toEqual([CANCEL_NOTICE]);
});

it("if the notice can't be saved, the session stays booked and its reminders stay", async () => {
  const { member, professional, sessionId } = await bookOneSession(app);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const refuseNotices = { table: "notifications", event: "insert", body: "raise exception 'refused';" };
  await withTrigger(db, refuseNotices, async () => {
    const res = await professional.post(cancelUrl(sessionId)).send({});
    expect(res.status).toBe(500);
  });
  vi.restoreAllMocks();

  expect((await member.get(SESSIONS_URL)).body.upcoming.items).toHaveLength(1);
  await deliverDueReminders(db, new Date(HOUR_BEFORE_DUE));
  expect(await textsFor(member)).toHaveLength(2);
});

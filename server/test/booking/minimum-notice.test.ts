import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import { reschedule } from "../sessions/helpers.js";
import { KOLKATA_FIRST, KOLKATA_STARTS, SESSIONS_URL, book, signUpProfessional } from "./helpers.js";

const MINUTE_MS = 60_000;
const LATER_SLOT = KOLKATA_STARTS[8];
const SLOT_START_MS = new Date(KOLKATA_FIRST).getTime();

// A slot is allowed when it starts exactly the notice away or further, so a clock 1 ms later refuses it.
const boundary = [
  { case: "1 ms outside the notice", clockOffsetMs: -1, allowed: true },
  { case: "exactly at the notice", clockOffsetMs: 0, allowed: true },
  { case: "1 ms inside the notice", clockOffsetMs: 1, allowed: false },
];

const notices = [
  { case: "the default of 120 minutes", saved: undefined, minutes: 120 },
  { case: "a saved notice of 45 minutes", saved: 45, minutes: 45 },
  { case: "a saved notice of none", saved: 0, minutes: 0 },
];

const clock = testClock("2027-01-11T04:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

async function signUpBoth(saved: number | undefined) {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  if (saved !== undefined) {
    await professional.agent.patch(`${API_V1}/settings/profile`).send({ minimumNoticeMinutes: saved });
  }
  return { professionalId: professional.id, member: await signUpAgent(app, testMember) };
}

describe.each(notices)("with $case", ({ saved, minutes }) => {
  describe.each(boundary)("$case", ({ clockOffsetMs, allowed }) => {
    const atBoundary = new Date(SLOT_START_MS - minutes * MINUTE_MS + clockOffsetMs).toISOString();

    it(`${allowed ? "offers" : "doesn't offer"} the slot`, async () => {
      clock.set(atBoundary);
      const { professionalId, member } = await signUpBoth(saved);

      const res = await member.get(`${API_V1}/professionals/${professionalId}/slots`);

      const starts = res.body.slots.map((slot: { start: string }) => slot.start);
      expect(starts.includes(new Date(KOLKATA_FIRST).toISOString())).toBe(allowed);
    });

    it(`${allowed ? "books" : "refuses to book"} the slot`, async () => {
      clock.set(atBoundary);
      const { professionalId, member } = await signUpBoth(saved);

      const res = await book(member, professionalId, KOLKATA_FIRST);

      if (allowed) {
        expect(res.status).toBe(201);
      } else {
        expect(res.status).toBe(422);
        expect(res.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);
        expect((await member.get(SESSIONS_URL)).body.upcoming.items).toEqual([]);
      }
    });

    it(`${allowed ? "moves a session to" : "refuses to move a session to"} the slot`, async () => {
      clock.set(atBoundary);
      const { professionalId, member } = await signUpBoth(saved);
      const booked = await book(member, professionalId, LATER_SLOT);

      const res = await reschedule(member, booked.body.session.id, KOLKATA_FIRST);

      const { items } = (await member.get(SESSIONS_URL)).body.upcoming;
      if (allowed) {
        expect(res.status).toBe(204);
        expect(items[0].start).toBe(new Date(KOLKATA_FIRST).toISOString());
      } else {
        expect(res.status).toBe(422);
        expect(res.body.error).toBe(ErrorCode.SLOT_NOT_AVAILABLE);
        expect(items[0].start).toBe(LATER_SLOT);
      }
    });
  });
});

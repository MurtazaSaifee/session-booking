import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { encodeCursor } from "../../src/paging.js";
import { SessionList } from "../../src/sessions/session-list.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import {
  CLOCK_START,
  KOLKATA_FIRST,
  SESSIONS_URL,
  SINGAPORE_SLOT,
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
  userId,
} from "../booking/helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

async function twoMembersAndTwoProfessionals() {
  const nora = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const owen = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  const noraBooking = await book(theo, nora.id, KOLKATA_FIRST);
  await book(iris, owen.id, SINGAPORE_SLOT);
  return { nora, owen, theo, iris, theoSessionId: noraBooking.body.session.id as string };
}

function sessionIds(body: Record<string, { items: { id: string }[] }>) {
  return Object.values(body).flatMap((list) => list.items.map((session) => session.id));
}

it.each([
  ["the list", SESSIONS_URL],
  ["a next page", `${SESSIONS_URL}/lists/${SessionList.PAST}?cursor=abc`],
  ["one session", `${SESSIONS_URL}/00000000-0000-4000-8000-000000000000`],
])("reading %s needs a sign-in", async (_name, url) => {
  const res = await request(app).get(url);

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it("a member's list holds only their own sessions", async () => {
  const { theo, iris, theoSessionId } = await twoMembersAndTwoProfessionals();

  const theoList = (await theo.get(SESSIONS_URL)).body;
  const irisList = (await iris.get(SESSIONS_URL)).body;

  expect(sessionIds(theoList)).toEqual([theoSessionId]);
  expect(irisList.upcoming.items).toHaveLength(1);
  expect(sessionIds(irisList)).not.toContain(theoSessionId);
});

it("a professional's list holds only their own schedule", async () => {
  const { nora, owen, theoSessionId } = await twoMembersAndTwoProfessionals();

  const noraList = (await nora.agent.get(SESSIONS_URL)).body;
  const owenList = (await owen.agent.get(SESSIONS_URL)).body;

  expect(sessionIds(noraList)).toEqual([theoSessionId]);
  expect(owenList.upcoming.items).toHaveLength(1);
  expect(sessionIds(owenList)).not.toContain(theoSessionId);
});

it("another person's session looks exactly like one that doesn't exist", async () => {
  const { owen, iris, theoSessionId } = await twoMembersAndTwoProfessionals();

  const missing = await iris.get(`${SESSIONS_URL}/00000000-0000-4000-8000-000000000000`);
  const otherMembers = await iris.get(`${SESSIONS_URL}/${theoSessionId}`);
  const otherProfessionals = await owen.agent.get(`${SESSIONS_URL}/${theoSessionId}`);

  expect(missing.status).toBe(404);
  expect(otherMembers.status).toBe(404);
  expect(otherMembers.body).toEqual(missing.body);
  expect(otherProfessionals.status).toBe(404);
  expect(otherProfessionals.body).toEqual(missing.body);
});

it("a hand-made cursor can't reach another person's sessions", async () => {
  const { iris, theoSessionId } = await twoMembersAndTwoProfessionals();
  const beforeEverything = encodeCursor({ value: CLOCK_START, id: theoSessionId });

  const res = await iris
    .get(`${SESSIONS_URL}/lists/${SessionList.UPCOMING}`)
    .query({ cursor: beforeEverything });

  expect(res.status).toBe(200);
  expect(res.body.items.map((session: { id: string }) => session.id)).not.toContain(theoSessionId);
});

it("sends the other person's name, but never their id or email", async () => {
  const { nora, theo, theoSessionId } = await twoMembersAndTwoProfessionals();
  const theoId = await userId(theo);

  const theoView = JSON.stringify([
    (await theo.get(SESSIONS_URL)).body,
    (await theo.get(`${SESSIONS_URL}/${theoSessionId}`)).body,
  ]);
  const noraView = JSON.stringify([
    (await nora.agent.get(SESSIONS_URL)).body,
    (await nora.agent.get(`${SESSIONS_URL}/${theoSessionId}`)).body,
  ]);

  expect(theoView).toContain(testProfessional.name);
  expect(theoView).not.toContain(nora.id);
  expect(theoView).not.toContain(testProfessional.email);
  expect(noraView).toContain(testMember.name);
  expect(noraView).not.toContain(theoId);
  expect(noraView).not.toContain(testMember.email);
});

it("ignores a person id in the query: only the sign-in decides whose sessions these are", async () => {
  const { iris, theo, theoSessionId } = await twoMembersAndTwoProfessionals();
  const theoId = await userId(theo);

  const res = await iris.get(SESSIONS_URL).query({ memberId: theoId });

  expect(res.status).toBe(200);
  expect(res.body.upcoming.items).toHaveLength(1);
  expect(sessionIds(res.body)).not.toContain(theoSessionId);
});

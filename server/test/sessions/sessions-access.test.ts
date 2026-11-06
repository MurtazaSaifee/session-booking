import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors.js";
import { encodeCursor } from "../../src/paging.js";
import { API_V1 } from "../../src/paths.js";
import { SessionList } from "../../src/sessions/session-list.js";
import { createTestApp, resetDb, testClock } from "../app.js";
import { createTestDb } from "../db.js";
import { CLOCK_START, KOLKATA_SECOND, SESSIONS_URL, userId } from "../booking/helpers.js";
import { reschedule, twoMembersAndTwoProfessionals } from "./helpers.js";

const LONGEST_NOTICE = 28 * 24 * 60;

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

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
  const { theo, iris, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const theoList = (await theo.get(SESSIONS_URL)).body;
  const irisList = (await iris.get(SESSIONS_URL)).body;

  expect(sessionIds(theoList)).toEqual([theoSessionId]);
  expect(irisList.upcoming.items).toHaveLength(1);
  expect(sessionIds(irisList)).not.toContain(theoSessionId);
});

it("a professional's list holds only their own schedule", async () => {
  const { nora, owen, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const noraList = (await nora.agent.get(SESSIONS_URL)).body;
  const owenList = (await owen.agent.get(SESSIONS_URL)).body;

  expect(sessionIds(noraList)).toEqual([theoSessionId]);
  expect(owenList.upcoming.items).toHaveLength(1);
  expect(sessionIds(owenList)).not.toContain(theoSessionId);
});

it("a hand-made cursor can't reach another person's sessions", async () => {
  const { iris, theoSessionId } = await twoMembersAndTwoProfessionals(app);
  const beforeEverything = encodeCursor({ value: CLOCK_START, id: theoSessionId });

  const res = await iris
    .get(`${SESSIONS_URL}/lists/${SessionList.UPCOMING}`)
    .query({ cursor: beforeEverything });

  expect(res.status).toBe(200);
  expect(res.body.items.map((session: { id: string }) => session.id)).not.toContain(theoSessionId);
});

it("ignores a person id in the query: only the sign-in decides whose sessions these are", async () => {
  const { iris, theo, theoSessionId } = await twoMembersAndTwoProfessionals(app);
  const theoId = await userId(theo);

  const res = await iris.get(SESSIONS_URL).query({ memberId: theoId });

  expect(res.status).toBe(200);
  expect(res.body.upcoming.items).toHaveLength(1);
  expect(sessionIds(res.body)).not.toContain(theoSessionId);
});

it("cancelling needs a sign-in", async () => {
  const { theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const res = await request(app).post(`${SESSIONS_URL}/${theoSessionId}/cancel`).send({});

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it.each([
  ["another professional's session", null],
  ["a session that doesn't exist", "00000000-0000-4000-8000-000000000000"],
  ["an id that isn't one", "not-an-id"],
])("cancelling %s is a 404 and changes nothing", async (_name, id) => {
  const { owen, theo, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const res = await owen.agent.post(`${SESSIONS_URL}/${id ?? theoSessionId}/cancel`).send({});

  expect(res.status).toBe(404);
  expect(res.body.error).toBe(ErrorCode.NOT_FOUND);
  expect((await theo.get(SESSIONS_URL)).body.upcoming.items).toHaveLength(1);
});

it("another member cancelling a member's session is a 404 and changes nothing", async () => {
  const { iris, theo, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const res = await iris.post(`${SESSIONS_URL}/${theoSessionId}/cancel`).send({});

  expect(res.status).toBe(404);
  expect(res.body.error).toBe(ErrorCode.NOT_FOUND);
  expect((await theo.get(SESSIONS_URL)).body.upcoming.items).toHaveLength(1);
});

it("rescheduling needs a sign-in", async () => {
  const { theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const res = await request(app)
    .post(`${SESSIONS_URL}/${theoSessionId}/reschedule`)
    .send({ start: KOLKATA_SECOND });

  expect(res.status).toBe(401);
  expect(res.body.error).toBe(ErrorCode.UNAUTHENTICATED);
});

it.each([
  ["the session's own professional", "nora"],
  ["another professional", "owen"],
] as const)("%s can't reschedule: only members can, and nothing changes", async (_name, who) => {
  const people = await twoMembersAndTwoProfessionals(app);

  const res = await reschedule(people[who].agent, people.theoSessionId, KOLKATA_SECOND);

  expect(res.status).toBe(403);
  expect(res.body.error).toBe(ErrorCode.WRONG_ROLE);
  expect((await people.theo.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { start: "2027-01-18T03:30:00.000Z" },
  ]);
});

it("another member rescheduling a member's session gets the same 404 as a session that doesn't exist", async () => {
  const { iris, theo, nora, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const real = await reschedule(iris, theoSessionId, KOLKATA_SECOND);
  const missing = await reschedule(iris, "00000000-0000-4000-8000-000000000000", KOLKATA_SECOND);

  expect(real.status).toBe(404);
  expect(real.body.error).toBe(ErrorCode.NOT_FOUND);
  expect(real.body).toEqual(missing.body);
  expect((await theo.get(SESSIONS_URL)).body.upcoming.items).toMatchObject([
    { start: "2027-01-18T03:30:00.000Z" },
  ]);
  expect((await nora.agent.get(`${API_V1}/notifications`)).body.items).toEqual([]);
});

it("rescheduling an id that isn't one is a 404", async () => {
  const { theo } = await twoMembersAndTwoProfessionals(app);

  const res = await reschedule(theo, "not-an-id", KOLKATA_SECOND);

  expect(res.status).toBe(404);
  expect(res.body.error).toBe(ErrorCode.NOT_FOUND);
});

it("another member's session gets the same 404 as a missing one when the new time is inside the notice", async () => {
  const { nora, iris, theoSessionId } = await twoMembersAndTwoProfessionals(app);
  await nora.agent.patch(`${API_V1}/settings/profile`).send({ minimumNoticeMinutes: LONGEST_NOTICE });

  const theirs = await reschedule(iris, theoSessionId, KOLKATA_SECOND);
  const missing = await reschedule(iris, "00000000-0000-4000-8000-000000000000", KOLKATA_SECOND);

  expect(theirs.status).toBe(404);
  expect(theirs.body).toEqual(missing.body);
});

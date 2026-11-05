import { afterAll, beforeEach, expect, it } from "vitest";
import { createTestApp, resetDb, testClock, testMember, testProfessional } from "../app.js";
import { createTestDb } from "../db.js";
import { CLOCK_START, SESSIONS_URL, userId } from "../booking/helpers.js";
import { twoMembersAndTwoProfessionals } from "./helpers.js";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

it("another person's session looks exactly like one that doesn't exist", async () => {
  const { owen, iris, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const missing = await iris.get(`${SESSIONS_URL}/00000000-0000-4000-8000-000000000000`);
  const otherMembers = await iris.get(`${SESSIONS_URL}/${theoSessionId}`);
  const otherProfessionals = await owen.agent.get(`${SESSIONS_URL}/${theoSessionId}`);

  expect(missing.status).toBe(404);
  expect(otherMembers.status).toBe(404);
  expect(otherMembers.body).toEqual(missing.body);
  expect(otherProfessionals.status).toBe(404);
  expect(otherProfessionals.body).toEqual(missing.body);
});

it("sends the other person's name, but never their id or email", async () => {
  const { nora, theo, theoSessionId } = await twoMembersAndTwoProfessionals(app);
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

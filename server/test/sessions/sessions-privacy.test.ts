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

it("sends the other person's name, but never their id or email, in the lists", async () => {
  const { nora, theo, theoSessionId } = await twoMembersAndTwoProfessionals(app);
  const theoId = await userId(theo);

  const theoLists = JSON.stringify((await theo.get(SESSIONS_URL)).body);
  const noraLists = JSON.stringify((await nora.agent.get(SESSIONS_URL)).body);
  const noraRead = JSON.stringify((await nora.agent.get(`${SESSIONS_URL}/${theoSessionId}`)).body);

  expect(theoLists).toContain(testProfessional.name);
  expect(theoLists).not.toContain(nora.id);
  expect(theoLists).not.toContain(testProfessional.email);
  expect(noraLists).toContain(testMember.name);
  expect(noraLists).not.toContain(theoId);
  expect(noraRead).not.toContain(theoId);
  expect(noraRead).not.toContain(testMember.email);
});

it("reading one session gives a member the professional's id, which the directory already shows, and no email", async () => {
  const { nora, theo, theoSessionId } = await twoMembersAndTwoProfessionals(app);

  const { session } = (await theo.get(`${SESSIONS_URL}/${theoSessionId}`)).body;

  expect(session.professionalId).toBe(nora.id);
  expect(JSON.stringify(session)).not.toContain(testProfessional.email);
});

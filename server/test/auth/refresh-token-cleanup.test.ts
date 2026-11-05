import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { deleteDeadRefreshTokens } from "../../src/auth/store.js";
import { API_V1 } from "../../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember } from "../app.js";
import { CLOCK_START, userId } from "../booking/helpers.js";
import { createTestDb } from "../db.js";

const REFRESH_URL = `${API_V1}/auth/refresh`;
const SEVEN_DAYS_LATER = "2027-01-18T04:00:00Z";

const clock = testClock(CLOCK_START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => {
  clock.set(CLOCK_START);
  return resetDb(db);
});

afterAll(() => db.destroy());

function tokenRows() {
  return db("refresh_tokens").select("id");
}

async function signUpWithCookie() {
  const res = await request(app).post(`${API_V1}/auth/signup`).send(testMember);
  const cookies = [res.headers["set-cookie"] ?? []].flat();
  const refresh = cookies.find((cookie) => cookie.startsWith("refresh_token="));
  if (!refresh) throw new Error("No refresh cookie");
  return refresh.split(";")[0];
}

it("a live token stays and still works", async () => {
  const agent = await signUpAgent(app, testMember);

  await deleteDeadRefreshTokens(db, clock.now());

  expect(await tokenRows()).toHaveLength(1);
  expect((await agent.post(REFRESH_URL).send({})).status).toBe(200);
});

it("a token used up by a refresh is removed, and replaying it still gets 401", async () => {
  const cookie = await signUpWithCookie();
  expect((await request(app).post(REFRESH_URL).set("Cookie", cookie).send({})).status).toBe(200);
  expect(await tokenRows()).toHaveLength(2);

  await deleteDeadRefreshTokens(db, clock.now());

  expect(await tokenRows()).toHaveLength(1);
  expect((await request(app).post(REFRESH_URL).set("Cookie", cookie).send({})).status).toBe(401);
});

it("logging out removes the token at the next clean-up", async () => {
  const agent = await signUpAgent(app, testMember);
  await agent.post(`${API_V1}/auth/logout`).send({});

  await deleteDeadRefreshTokens(db, clock.now());

  expect(await tokenRows()).toEqual([]);
});

it("an expired token is removed from the moment it stops working, not before", async () => {
  await signUpAgent(app, testMember);

  await deleteDeadRefreshTokens(db, new Date(new Date(SEVEN_DAYS_LATER).getTime() - 1));
  expect(await tokenRows()).toHaveLength(1);

  await deleteDeadRefreshTokens(db, new Date(SEVEN_DAYS_LATER));
  expect(await tokenRows()).toEqual([]);
});

it.each([
  { case: "several batches", batchSize: 2 },
  { case: "an exactly filled batch", batchSize: 6 },
])("removes every dead token across $case", async ({ batchSize }) => {
  const agent = await signUpAgent(app, testMember);
  const id = await userId(agent);
  await db("refresh_tokens").insert(
    Array.from({ length: 5 }, (_, index) => ({
      user_id: id,
      token_hash: `dead-${index}`,
      expires_at: new Date(SEVEN_DAYS_LATER),
      revoked_at: new Date(CLOCK_START),
    })),
  );
  await db("refresh_tokens")
    .whereNull("revoked_at")
    .update({ revoked_at: new Date(CLOCK_START) });

  await deleteDeadRefreshTokens(db, clock.now(), batchSize);

  expect(await tokenRows()).toEqual([]);
});

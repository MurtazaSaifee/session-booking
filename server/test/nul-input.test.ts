import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { encodeCursor } from "../src/paging.js";
import { API_V1 } from "../src/paths.js";
import { createTestApp, resetDb, signUpAgent, testClock, testMember, testProfessional } from "./app.js";
import { createTestDb } from "./db.js";

const NUL_TEXT = "a\u0000b";
const ID = "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b";

const clock = testClock("2027-01-11T04:00:00Z");

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

function expectRefused(res: { status: number; body: { error: string } }) {
  expect(res.status).toBe(400);
  expect(res.body.error).toBe(ErrorCode.VALIDATION);
}

it("log-in refuses a NUL in the email", async () => {
  const res = await request(app)
    .post(`${API_V1}/auth/login`)
    .send({ email: `${NUL_TEXT}@example.com`, password: testMember.password });

  expectRefused(res);
});

it("sign-up refuses a NUL in the name", async () => {
  const res = await request(app)
    .post(`${API_V1}/auth/signup`)
    .send({ ...testMember, name: NUL_TEXT });

  expectRefused(res);
});

it("a profile edit refuses a NUL in the bio", async () => {
  const professional = await signUpAgent(app, testProfessional);

  const res = await professional.patch(`${API_V1}/settings/profile`).send({ bio: NUL_TEXT });

  expectRefused(res);
});

it("the professionals list refuses a NUL in a cursor", async () => {
  const member = await signUpAgent(app, testMember);

  const res = await member
    .get(`${API_V1}/professionals`)
    .query({ cursor: encodeCursor({ value: NUL_TEXT, id: ID }) });

  expectRefused(res);
});

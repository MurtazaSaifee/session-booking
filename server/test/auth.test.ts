import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { signAccessToken, hashRefreshToken } from "../src/auth/tokens.js";
import { createTestApp, resetDb, testClock } from "./app.js";
import { createTestDb } from "./db.js";

const START = "2027-01-15T09:00:00Z";
const clock = testClock(START);

const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(START);
  await resetDb(db);
});

afterAll(() => db.end());

const member = {
  role: "member",
  name: "Sam Member",
  email: "sam@example.com",
  password: "correct horse",
  timezone: "Europe/London",
};

const professional = {
  role: "professional",
  name: "Priya Pro",
  email: "priya@example.com",
  password: "correct horse",
  timezone: "America/New_York",
  title: "Counsellor",
  bio: "I help people plan their week.",
};

function setCookies(res: request.Response): string[] {
  return [res.headers["set-cookie"] ?? []].flat();
}

function cookieNamed(cookies: string[], name: string): string {
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`No ${name} cookie`);
  return found;
}

function cookieValue(cookies: string[], name: string): string {
  return cookieNamed(cookies, name).slice(name.length + 1).split(";")[0];
}

it("member sign-up returns the user and sets HttpOnly cookies", async () => {
  const res = await request(app).post("/api/v1/auth/signup").send(member);

  expect(res.status).toBe(201);
  expect(res.body.user).toEqual({
    id: expect.any(String),
    role: "member",
    name: "Sam Member",
    email: "sam@example.com",
    timezone: "Europe/London",
    title: null,
    bio: null,
  });
  expect(res.body.user).not.toHaveProperty("password_hash");

  const cookies = setCookies(res);
  const access = cookieNamed(cookies, "access_token");
  const refresh = cookieNamed(cookies, "refresh_token");
  expect(access).toMatch(/HttpOnly/);
  expect(access).toMatch(/SameSite=Lax/);
  expect(refresh).toMatch(/HttpOnly/);
  expect(refresh).toMatch(/SameSite=Lax/);
  expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
});

it("professional sign-up needs a title and bio", async () => {
  const { title: _title, bio: _bio, ...withoutProfile } = professional;

  const missing = await request(app).post("/api/v1/auth/signup").send(withoutProfile);
  expect(missing.status).toBe(400);
  expect(missing.body.error).toBe("VALIDATION");

  const res = await request(app).post("/api/v1/auth/signup").send(professional);
  expect(res.status).toBe(201);
  expect(res.body.user).toMatchObject({ role: "professional", title: "Counsellor", bio: "I help people plan their week." });
});

it.each([
  ["invalid email", { ...member, email: "not-an-email" }],
  ["a 7-character password", { ...member, password: "1234567" }],
  ["an unknown timezone", { ...member, timezone: "Mars/Olympus" }],
  ["an unknown role", { ...member, role: "admin" }],
])("sign-up with %s returns 400 VALIDATION", async (_label, body) => {
  const res = await request(app).post("/api/v1/auth/signup").send(body);

  expect(res.status).toBe(400);
  expect(res.body.error).toBe("VALIDATION");
});

it.each([
  ["an unknown role", { ...member, role: "admin" }],
  ["no role", { ...member, role: undefined }],
])("sign-up with %s asks to choose member or professional", async (_label, body) => {
  const res = await request(app).post("/api/v1/auth/signup").send(body);

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: "VALIDATION", message: "Please choose member or professional." });
});

it("emails are unique regardless of case", async () => {
  const first = await request(app).post("/api/v1/auth/signup").send({ ...member, email: "Sam@Example.com" });
  expect(first.status).toBe(201);

  const second = await request(app).post("/api/v1/auth/signup").send({ ...member, email: "sam@example.com" });
  expect(second.status).toBe(409);
  expect(second.body).toEqual({ error: "EMAIL_TAKEN", message: "An account with this email already exists." });
});

it("wrong password and unknown email give the same 401", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const wrongPassword = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: member.email, password: "wrong password" });
  const unknownEmail = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "nobody@example.com", password: member.password });

  const expected = { error: "BAD_CREDENTIALS", message: "Email or password is incorrect." };
  expect(wrongPassword.status).toBe(401);
  expect(wrongPassword.body).toEqual(expected);
  expect(unknownEmail.status).toBe(401);
  expect(unknownEmail.body).toEqual(expected);
});

it("GET /me returns the signed-in user, and 401 without cookies", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const agent = request.agent(app);
  const login = await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });
  expect(login.status).toBe(200);

  const me = await agent.get("/api/v1/auth/me");
  expect(me.status).toBe(200);
  expect(me.body.user).toMatchObject({ email: "sam@example.com", role: "member" });

  const anonymous = await request(app).get("/api/v1/auth/me");
  expect(anonymous.status).toBe(401);
  expect(anonymous.body).toEqual({ error: "UNAUTHENTICATED", message: "Please log in." });
});

it("the access token expires 15 minutes after sign-in", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const agent = request.agent(app);
  await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });

  clock.advanceMinutes(14);
  expect((await agent.get("/api/v1/auth/me")).status).toBe(200);

  clock.advanceMinutes(2);
  expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
});

it("an access token signed with another secret is rejected", async () => {
  const signup = await request(app).post("/api/v1/auth/signup").send(member);
  const forged = await signAccessToken({ id: signup.body.user.id, role: "member" }, "wrong-secret", clock.now());

  const res = await request(app).get("/api/v1/auth/me").set("Cookie", `access_token=${forged}`);

  expect(res.status).toBe(401);
  expect(res.body.error).toBe("UNAUTHENTICATED");
});

it("only the hash of the refresh token is stored", async () => {
  const res = await request(app).post("/api/v1/auth/signup").send(member);
  const refresh = cookieNamed(setCookies(res), "refresh_token");
  const value = refresh.slice("refresh_token=".length).split(";")[0];

  const stored = await db.query<{ token_hash: string }>("select token_hash from refresh_tokens");
  const hashes = stored.rows.map((row) => row.token_hash);

  expect(hashes).not.toContain(value);
  expect(hashes).toContain(hashRefreshToken(value));
});

it("refresh issues a new pair of cookies", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const agent = request.agent(app);
  const login = await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });
  const oldAccess = cookieValue(setCookies(login), "access_token");
  const oldRefresh = cookieValue(setCookies(login), "refresh_token");

  clock.advanceMinutes(15);
  const res = await agent.post("/api/v1/auth/refresh").send({});
  expect(res.status).toBe(200);
  expect(res.body.user).toMatchObject({ email: "sam@example.com", role: "member" });

  const cookies = setCookies(res);
  expect(cookieValue(cookies, "access_token")).not.toBe(oldAccess);
  expect(cookieValue(cookies, "refresh_token")).not.toBe(oldRefresh);
  expect((await agent.get("/api/v1/auth/me")).status).toBe(200);
});

it("the old refresh token is refused after it has rotated", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const agent = request.agent(app);
  const login = await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });
  const oldRefresh = cookieValue(setCookies(login), "refresh_token");

  expect((await agent.post("/api/v1/auth/refresh").send({})).status).toBe(200);

  const reused = await request(app).post("/api/v1/auth/refresh").send({}).set("Cookie", `refresh_token=${oldRefresh}`);
  expect(reused.status).toBe(401);
  expect(reused.body).toEqual({ error: "UNAUTHENTICATED", message: "Please log in." });
});

it("a refresh token expires after 7 days", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const agent = request.agent(app);
  await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });
  clock.advanceMinutes(7 * 24 * 60 - 1);
  expect((await agent.post("/api/v1/auth/refresh").send({})).status).toBe(200);

  const login = await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });
  const refresh = cookieValue(setCookies(login), "refresh_token");
  clock.advanceMinutes(7 * 24 * 60 + 1);

  const expired = await request(app).post("/api/v1/auth/refresh").send({}).set("Cookie", `refresh_token=${refresh}`);
  expect(expired.status).toBe(401);
});

it("log out revokes the refresh token and clears both cookies", async () => {
  await request(app).post("/api/v1/auth/signup").send(member);

  const agent = request.agent(app);
  const login = await agent.post("/api/v1/auth/login").send({ email: member.email, password: member.password });
  const refresh = cookieValue(setCookies(login), "refresh_token");

  const out = await agent.post("/api/v1/auth/logout").send({});
  expect(out.status).toBe(204);
  const cleared = setCookies(out);
  expect(cookieNamed(cleared, "access_token")).toMatch(/Expires=Thu, 01 Jan 1970/);
  expect(cookieNamed(cleared, "refresh_token")).toMatch(/Expires=Thu, 01 Jan 1970/);

  expect((await agent.get("/api/v1/auth/me")).status).toBe(401);

  const reused = await request(app).post("/api/v1/auth/refresh").send({}).set("Cookie", `refresh_token=${refresh}`);
  expect(reused.status).toBe(401);
});

it("refresh without a cookie is 401, and log out without a cookie is 204", async () => {
  const refresh = await request(app).post("/api/v1/auth/refresh").send({});
  expect(refresh.status).toBe(401);
  expect(refresh.body).toEqual({ error: "UNAUTHENTICATED", message: "Please log in." });

  const logout = await request(app).post("/api/v1/auth/logout").send({});
  expect(logout.status).toBe(204);
});

it("two refreshes at the same moment with one token: only one wins", async () => {
  const signup = await request(app).post("/api/v1/auth/signup").send(member);
  const refresh = cookieValue(setCookies(signup), "refresh_token");

  const attempt = () =>
    request(app).post("/api/v1/auth/refresh").send({}).set("Cookie", `refresh_token=${refresh}`);
  const [first, second] = await Promise.all([attempt(), attempt()]);

  expect([first.status, second.status].sort()).toEqual([200, 401]);
});

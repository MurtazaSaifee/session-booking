import request from "supertest";
import { afterAll, beforeEach, expect, it } from "vitest";
import { API_V1 } from "../src/paths.js";
import { ReminderStatus } from "../src/reminders/reminder-values.js";
import { deliverDueReminders } from "../src/reminders/deliver.js";
import { Role } from "../src/roles.js";
import { SessionStatus } from "../src/session-status.js";
import { DEMO_MEMBERS, DEMO_PASSWORD, DEMO_PROFESSIONALS, seedIfEmpty } from "../src/seed.js";
import { createTestApp, resetDb, testClock } from "./app.js";
import { CLOCK_START, SESSIONS_URL } from "./booking/helpers.js";
import { createTestDb } from "./db.js";
import { textsFor } from "./reminders/helpers.js";

const clock = testClock(CLOCK_START);
const db = createTestDb();
const app = createTestApp(db, clock.now);

beforeEach(async () => {
  clock.set(CLOCK_START);
  await resetDb(db);
});

afterAll(() => db.destroy());

async function logInAs(email: string) {
  const agent = request.agent(app);
  const res = await agent.post(`${API_V1}/auth/login`).send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

it("seeds demo professionals, members, hours, and sessions on an empty database", async () => {
  const seeded = await seedIfEmpty(db, clock.now());
  expect(seeded).toBe(true);

  // 4 professionals and 2 members
  const users = await db("users").select("name", "email", "role", "timezone", "title").orderBy("email");
  expect(users).toHaveLength(6);

  const members = users.filter((u) => u.role === Role.MEMBER);
  expect(members).toHaveLength(2);
  expect(members.map((m) => m.name)).toEqual(["Alex Morgan", "Sam Lee"]);
  expect(members.map((m) => m.timezone)).toEqual(["Europe/London", "Asia/Singapore"]);

  const professionals = users.filter((u) => u.role === Role.PROFESSIONAL);
  expect(professionals).toHaveLength(4);
  expect(professionals.map((p) => p.name)).toEqual([
    "Aisha Rahman",
    "Daniel Tan",
    "Emily Clarke",
    "Priya Nair",
  ]);

  // Working hours: all 4 professionals have hours, and at least one has a lunch break
  const hours = await db("working_hours").whereNull("deleted_at");
  expect(hours.length).toBeGreaterThan(0);

  const priyaUser = await db("users").where({ email: "priya@example.com" }).first();
  const priyaHours = await db("working_hours")
    .where({ professional_id: priyaUser.id })
    .whereNull("deleted_at")
    .orderBy(["weekday", "start_time"]);

  // Priya works Monday-Friday with a lunch break (two ranges per day)
  expect(priyaHours).toHaveLength(10);
  expect(priyaHours[0]).toMatchObject({ weekday: 1, start_time: "09:30:00", end_time: "13:00:00" });
  expect(priyaHours[1]).toMatchObject({ weekday: 1, start_time: "14:00:00", end_time: "18:00:00" });

  // Exactly 2 sessions: one upcoming ~70m after seed, one past
  const sessions = await db("sessions").select("*").orderBy("starts_at");
  expect(sessions).toHaveLength(2);

  const [pastSession, upcomingSession] = sessions;
  expect(pastSession.status).toBe(SessionStatus.BOOKED);
  expect(upcomingSession.status).toBe(SessionStatus.BOOKED);

  const nowMs = clock.now().getTime();
  const upcomingStartMs = new Date(upcomingSession.starts_at).getTime();
  expect(upcomingStartMs - nowMs).toBe(70 * 60_000);
  expect(new Date(upcomingSession.ends_at).getTime() - upcomingStartMs).toBe(50 * 60_000);

  const pastStartMs = new Date(pastSession.starts_at).getTime();
  expect(pastStartMs).toBeLessThan(nowMs);

  // Exactly 2 reminders created (the 1-hour reminders for the upcoming session)
  const reminders = await db("reminders").select("*");
  expect(reminders).toHaveLength(2);
  expect(reminders.every((r) => r.kind === "HOUR_BEFORE")).toBe(true);
  expect(reminders.every((r) => r.status === ReminderStatus.PENDING)).toBe(true);
  expect(reminders.every((r) => r.session_id === upcomingSession.id)).toBe(true);

  // 1-hour reminder due at start - 1h = now + 10 minutes
  const dueMs = new Date(reminders[0].due_at).getTime();
  expect(dueMs - nowMs).toBe(10 * 60_000);
});

it("runs only when there are no users, so restarts never duplicate data", async () => {
  const first = await seedIfEmpty(db, clock.now());
  expect(first).toBe(true);

  const countsBefore = {
    users: await db("users").count(),
    hours: await db("working_hours").count(),
    sessions: await db("sessions").count(),
    reminders: await db("reminders").count(),
  };

  // Second run simulates a restart or concurrent startup
  const second = await seedIfEmpty(db, clock.now());
  expect(second).toBe(false);

  const countsAfter = {
    users: await db("users").count(),
    hours: await db("working_hours").count(),
    sessions: await db("sessions").count(),
    reminders: await db("reminders").count(),
  };

  expect(countsAfter).toEqual(countsBefore);
});

it("lets every demo member and professional sign in with the shared demo password", async () => {
  await seedIfEmpty(db, clock.now());

  for (const member of DEMO_MEMBERS) {
    const agent = await logInAs(member.email);
    const me = (await agent.get(`${API_V1}/auth/me`)).body.user;
    expect(me.name).toBe(member.name);
    expect(me.role).toBe(Role.MEMBER);
  }

  for (const professional of DEMO_PROFESSIONALS) {
    const agent = await logInAs(professional.email);
    const me = (await agent.get(`${API_V1}/auth/me`)).body.user;
    expect(me.name).toBe(professional.name);
    expect(me.role).toBe(Role.PROFESSIONAL);
  }
});

it("shows upcoming and past sessions on My Sessions for both roles", async () => {
  await seedIfEmpty(db, clock.now());

  // Member Sam Lee sees 1 upcoming session with Priya Nair and 1 past session
  const sam = await logInAs("sam@example.com");
  const samSessions = (await sam.get(SESSIONS_URL)).body;
  expect(samSessions.upcoming.items).toHaveLength(1);
  expect(samSessions.upcoming.items[0].otherPersonName).toBe("Priya Nair");
  expect(samSessions.past.items).toHaveLength(1);
  expect(samSessions.past.items[0].otherPersonName).toBe("Priya Nair");

  // Professional Priya Nair sees 1 upcoming session with Sam Lee and 1 past session
  const priya = await logInAs("priya@example.com");
  const priyaSessions = (await priya.get(SESSIONS_URL)).body;
  expect(priyaSessions.upcoming.items).toHaveLength(1);
  expect(priyaSessions.upcoming.items[0].otherPersonName).toBe("Sam Lee");
  expect(priyaSessions.past.items).toHaveLength(1);
  expect(priyaSessions.past.items[0].otherPersonName).toBe("Sam Lee");

  // Directory lists all 4 professionals
  const directoryRes = await sam.get(`${API_V1}/professionals`);
  expect(directoryRes.status).toBe(200);
  expect(directoryRes.body.items).toHaveLength(4);
});

it("fires the 1-hour reminder ~10 minutes after start-up", async () => {
  await seedIfEmpty(db, clock.now());

  const sam = await logInAs("sam@example.com");
  const priya = await logInAs("priya@example.com");

  // Before 10 minutes: no notifications yet
  await deliverDueReminders(db, clock.now());
  expect(await textsFor(sam)).toEqual([]);
  expect(await textsFor(priya)).toEqual([]);

  // Advance clock by 10 minutes: 1-hour reminder is now due
  clock.advanceMinutes(10);
  await deliverDueReminders(db, clock.now());

  const samTexts = await textsFor(sam);
  expect(samTexts).toHaveLength(1);
  expect(samTexts[0]).toContain("Your session with Priya Nair is on");

  const priyaTexts = await textsFor(priya);
  expect(priyaTexts).toHaveLength(1);
  expect(priyaTexts[0]).toContain("Your session with Sam Lee is on");
});

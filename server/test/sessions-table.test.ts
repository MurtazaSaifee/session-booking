import { afterAll, beforeEach, expect, it } from "vitest";
import { SESSION_MINUTES } from "../src/directory/slots.js";
import { Role } from "../src/roles.js";
import { SessionStatus } from "../src/sessions/status.js";
import { resetDb } from "./app.js";
import { createTestDb } from "./db.js";

const db = createTestDb();

beforeEach(() => resetDb(db));

afterAll(() => db.destroy());

async function insertUser(role: Role, name: string, email: string, timezone: string) {
  const [user] = await db("users")
    .insert({ role, name, email, password_hash: "not-a-real-hash", timezone })
    .returning("id");
  return user.id as string;
}

function insertSession(
  memberId: string,
  professionalId: string,
  startsAt: string,
  status: SessionStatus = SessionStatus.BOOKED,
) {
  const start = new Date(startsAt);
  return db("sessions").insert({
    member_id: memberId,
    professional_id: professionalId,
    starts_at: start,
    ends_at: new Date(start.getTime() + SESSION_MINUTES * 60_000),
    status,
  });
}

it("two members cannot have overlapping booked sessions with one professional", async () => {
  const theo = await insertUser(Role.MEMBER, "Theo Marsh", "theo@example.com", "Asia/Singapore");
  const iris = await insertUser(Role.MEMBER, "Iris Penn", "iris@example.com", "Europe/London");
  const nora = await insertUser(Role.PROFESSIONAL, "Nora Quill", "nora@example.com", "Asia/Kolkata");
  await insertSession(theo, nora, "2027-01-18T09:00:00Z");

  await expect(insertSession(iris, nora, "2027-01-18T09:30:00Z")).rejects.toMatchObject({
    constraint: "sessions_professional_overlap",
  });
});

it("one member cannot have overlapping booked sessions with two professionals", async () => {
  const theo = await insertUser(Role.MEMBER, "Theo Marsh", "theo@example.com", "Asia/Singapore");
  const nora = await insertUser(Role.PROFESSIONAL, "Nora Quill", "nora@example.com", "Asia/Kolkata");
  const owen = await insertUser(Role.PROFESSIONAL, "Owen Hale", "owen@example.com", "Europe/Paris");
  await insertSession(theo, nora, "2027-01-18T09:00:00Z");

  await expect(insertSession(theo, owen, "2027-01-18T09:30:00Z")).rejects.toMatchObject({
    constraint: "sessions_member_overlap",
  });
});

it("a session that starts exactly when another ends is accepted", async () => {
  const theo = await insertUser(Role.MEMBER, "Theo Marsh", "theo@example.com", "Asia/Singapore");
  const nora = await insertUser(Role.PROFESSIONAL, "Nora Quill", "nora@example.com", "Asia/Kolkata");
  await insertSession(theo, nora, "2027-01-18T09:00:00Z");

  await expect(insertSession(theo, nora, "2027-01-18T09:50:00Z")).resolves.toBeDefined();
});

it("a cancelled session doesn't block the time", async () => {
  const theo = await insertUser(Role.MEMBER, "Theo Marsh", "theo@example.com", "Asia/Singapore");
  const nora = await insertUser(Role.PROFESSIONAL, "Nora Quill", "nora@example.com", "Asia/Kolkata");
  await insertSession(theo, nora, "2027-01-18T09:00:00Z", SessionStatus.CANCELLED);

  await expect(insertSession(theo, nora, "2027-01-18T09:00:00Z")).resolves.toBeDefined();
});

it("two different pairs of people can have sessions at the same time", async () => {
  const theo = await insertUser(Role.MEMBER, "Theo Marsh", "theo@example.com", "Asia/Singapore");
  const iris = await insertUser(Role.MEMBER, "Iris Penn", "iris@example.com", "Europe/London");
  const nora = await insertUser(Role.PROFESSIONAL, "Nora Quill", "nora@example.com", "Asia/Kolkata");
  const owen = await insertUser(Role.PROFESSIONAL, "Owen Hale", "owen@example.com", "Europe/Paris");
  await insertSession(theo, nora, "2027-01-18T09:00:00Z");

  await expect(insertSession(iris, owen, "2027-01-18T09:00:00Z")).resolves.toBeDefined();
});

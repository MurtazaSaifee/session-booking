import type { Express } from "express";
import type { Db } from "../../src/db.js";
import { API_V1 } from "../../src/paths.js";
import { SessionStatus } from "../../src/session-status.js";
import { signUpAgent, testMember, testProfessional } from "../app.js";

const MONDAY = 1;

export const SESSIONS_URL = `${API_V1}/sessions`;
export const CLOCK_START = "2027-01-11T04:00:00Z";

// Next Monday's slots with the Kolkata professional's 09:00-12:00 hours.
export const KOLKATA_FIRST = "2027-01-18T03:30:00Z";
export const KOLKATA_SECOND = "2027-01-18T04:30:00Z";
// The Singapore professional's 13:00-14:00 hours overlap the Kolkata second slot.
export const SINGAPORE_SLOT = "2027-01-18T05:00:00Z";
// 24 slots: the next three Mondays with 09:00-17:00 hours in Kolkata.
export const KOLKATA_STARTS = ["2027-01-18", "2027-01-25", "2027-02-01"].flatMap((day) =>
  ["03:30", "04:30", "05:30", "06:30", "07:30", "08:30", "09:30", "10:30"].map(
    (time) => `${day}T${time}:00.000Z`,
  ),
);

export const otherMember = {
  ...testMember,
  name: "Iris Penn",
  email: "iris@example.com",
  timezone: "Europe/London",
};

export const singaporeProfessional = {
  ...testProfessional,
  name: "Owen Hale",
  email: "owen@example.com",
  timezone: "Asia/Singapore",
};

export type Agent = Awaited<ReturnType<typeof signUpAgent>>;

export async function userId(agent: Agent) {
  return (await agent.get(`${API_V1}/auth/me`)).body.user.id as string;
}

export async function signUpProfessional(
  app: Express,
  user: typeof testProfessional,
  start: string,
  end: string,
) {
  const agent = await signUpAgent(app, user);
  await agent.put(`${API_V1}/settings/hours`).send({ ranges: [{ weekday: MONDAY, start, end }] });
  return { agent, id: await userId(agent) };
}

// A week's jump on the test clock also expires the sign-in, so tests log in again at the new time.
export function logIn(agent: Agent, user: { email: string; password: string }) {
  return agent.post(`${API_V1}/auth/login`).send({ email: user.email, password: user.password });
}

export function book(member: Agent, professionalId: string, start: string) {
  return member.post(SESSIONS_URL).send({ professionalId, start });
}

// Cancelling has no route yet, so this writes what that route will.
export function markCancelled(db: Db, sessionId: string, cancelledBy: string, at: string) {
  return db("sessions")
    .where({ id: sessionId })
    .update({ status: SessionStatus.CANCELLED, cancelled_by: cancelledBy, cancelled_at: new Date(at) });
}

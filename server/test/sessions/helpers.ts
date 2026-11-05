import type { Express } from "express";
import { API_V1 } from "../../src/paths.js";
import { signUpAgent, testMember, testProfessional } from "../app.js";

const MONDAY = 1;

export const SESSIONS_URL = `${API_V1}/sessions`;
export const CLOCK_START = "2027-01-11T04:00:00Z";

// Next Monday's slots with the Kolkata professional's 09:00-12:00 hours.
export const KOLKATA_FIRST = "2027-01-18T03:30:00Z";
export const KOLKATA_SECOND = "2027-01-18T04:30:00Z";
// The Singapore professional's 13:00-14:00 hours overlap the Kolkata second slot.
export const SINGAPORE_SLOT = "2027-01-18T05:00:00Z";

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

export function book(member: Agent, professionalId: string, start: string) {
  return member.post(SESSIONS_URL).send({ professionalId, start });
}

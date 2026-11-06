import type { Express } from "express";
import { API_V1 } from "../../src/paths.js";
import { signUpAgent, testMember, testProfessional } from "../app.js";
import { KOLKATA_FIRST, book, signUpProfessional, userId, type Agent } from "../booking/helpers.js";

export const NOTIFICATIONS_URL = `${API_V1}/notifications`;

// A Singapore member books the Kolkata professional's first slot next Monday, which is 9:00am for the
// professional and 11:30am for the member.
export const SESSION_START = KOLKATA_FIRST;
export const DAY_BEFORE_DUE = "2027-01-17T03:30:00Z";
export const HOUR_BEFORE_DUE = "2027-01-18T02:30:00Z";
export const MEMBER_READS = `Your session with ${testProfessional.name} is on Mon 18 Jan at 11:30am`;
export const PROFESSIONAL_READS = `Your session with ${testMember.name} is on Mon 18 Jan at 9:00am`;

export async function bookOneSession(app: Express, minimumNoticeMinutes?: number) {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  if (minimumNoticeMinutes !== undefined) {
    await professional.agent.patch(`${API_V1}/settings/profile`).send({ minimumNoticeMinutes });
  }
  const member = await signUpAgent(app, testMember);
  const res = await book(member, professional.id, SESSION_START);
  if (res.status !== 201) throw new Error(`Booking failed with ${res.status}`);
  return {
    member,
    professional: professional.agent,
    memberId: await userId(member),
    professionalId: professional.id,
    sessionId: res.body.session.id as string,
  };
}

export async function textsFor(agent: Agent): Promise<string[]> {
  const res = await agent.get(NOTIFICATIONS_URL);
  return (res.body.items as { text: string }[]).map((item) => item.text);
}

import type { Express } from "express";
import type { Db } from "../../src/db.js";
import { signUpAgent, testMember, testProfessional } from "../app.js";
import { KOLKATA_FIRST, book, signUpProfessional, userId } from "../booking/helpers.js";

// A Singapore member books the Kolkata professional's first slot next Monday, which is 9:00am for the
// professional and 11:30am for the member.
export const SESSION_START = KOLKATA_FIRST;
export const DAY_BEFORE_DUE = "2027-01-17T03:30:00Z";
export const HOUR_BEFORE_DUE = "2027-01-18T02:30:00Z";
export const MEMBER_READS = `Your session with ${testProfessional.name} is on Mon 18 Jan at 11:30am`;
export const PROFESSIONAL_READS = `Your session with ${testMember.name} is on Mon 18 Jan at 9:00am`;

export async function bookOneSession(app: Express) {
  const professional = await signUpProfessional(app, testProfessional, "09:00", "12:00");
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

export async function textsFor(db: Db, recipientId: string): Promise<string[]> {
  const rows: { text: string }[] = await db("notifications")
    .where({ recipient_id: recipientId })
    .select("text");
  return rows.map((row) => row.text);
}

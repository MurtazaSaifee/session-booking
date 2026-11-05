import type { Express } from "express";
import { signUpAgent, testMember, testProfessional } from "../app.js";
import {
  KOLKATA_FIRST,
  SINGAPORE_SLOT,
  book,
  otherMember,
  signUpProfessional,
  singaporeProfessional,
} from "../booking/helpers.js";

export async function twoMembersAndTwoProfessionals(app: Express) {
  const nora = await signUpProfessional(app, testProfessional, "09:00", "12:00");
  const owen = await signUpProfessional(app, singaporeProfessional, "13:00", "14:00");
  const theo = await signUpAgent(app, testMember);
  const iris = await signUpAgent(app, otherMember);
  const noraBooking = await book(theo, nora.id, KOLKATA_FIRST);
  await book(iris, owen.id, SINGAPORE_SLOT);
  return { nora, owen, theo, iris, theoSessionId: noraBooking.body.session.id as string };
}

import { IANAZone } from "luxon";
import { z } from "zod";
import { Role } from "../roles.js";

const common = {
  name: z
    .string("Please enter your name.")
    .trim()
    .min(1, "Please enter your name.")
    .max(100, "Name must be 100 characters or fewer."),
  email: z.email("Please enter a valid email address."),
  password: z
    .string("Password must be at least 8 characters.")
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password must be 200 characters or fewer."),
  timezone: z
    .string("Please choose a valid timezone.")
    .refine((zone) => IANAZone.isValidZone(zone), "Please choose a valid timezone."),
};

const professionalFields = {
  title: z
    .string("Please enter your role, e.g. Counsellor.")
    .trim()
    .min(1, "Please enter your role, e.g. Counsellor.")
    .max(100, "Role must be 100 characters or fewer."),
  bio: z
    .string("Please enter a short bio.")
    .trim()
    .min(1, "Please enter a short bio.")
    .max(1000, "Bio must be 1000 characters or fewer."),
};

export const signupSchema = z.discriminatedUnion(
  "role",
  [
    z.object({ role: z.literal(Role.MEMBER), ...common }),
    z.object({ role: z.literal(Role.PROFESSIONAL), ...common, ...professionalFields }),
  ],
  "Please choose member or professional.",
);

export const loginSchema = z.object({
  email: z.string("Please enter your email address.").min(1, "Please enter your email address."),
  password: z.string("Please enter your password.").min(1, "Please enter your password."),
});

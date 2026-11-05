import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { Role, type SignedInUser } from "../roles.js";

const MINUTE_MS = 60_000;
const ACCESS_TOKEN_MINUTES = 15;
export const ACCESS_TOKEN_MS = ACCESS_TOKEN_MINUTES * MINUTE_MS;
export const REFRESH_TOKEN_MS = 7 * 24 * 60 * MINUTE_MS;

export type SignIn = { accessToken: string; refreshToken: string };

export async function signAccessToken(user: SignedInUser, secret: string, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TOKEN_MINUTES * 60)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(token: string, secret: string, now: Date): Promise<SignedInUser> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
    currentDate: now,
  });
  if (
    typeof payload.sub !== "string" ||
    (payload.role !== Role.MEMBER && payload.role !== Role.PROFESSIONAL)
  ) {
    throw new Error("Token has no valid user");
  }
  return { id: payload.sub, role: payload.role };
}

export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

// A fast hash is fine because the token is random, not a guessable password.
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

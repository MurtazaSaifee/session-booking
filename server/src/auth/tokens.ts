import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { Role } from "../roles.js";

export const ACCESS_TOKEN_MINUTES = 15;
export const REFRESH_TOKEN_DAYS = 7;

export async function signAccessToken(user: { id: string; role: Role }, secret: string, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TOKEN_MINUTES * 60)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(token: string, secret: string, now: Date): Promise<{ id: string; role: Role }> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
    currentDate: now,
  });
  if (typeof payload.sub !== "string" || (payload.role !== Role.MEMBER && payload.role !== Role.PROFESSIONAL)) {
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

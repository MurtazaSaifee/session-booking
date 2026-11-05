import type { Response } from "express";
import type { AppDeps } from "../app.js";
import type { Db } from "../db.js";
import type { SignedInUser } from "../roles.js";
import { setSignInCookies } from "./cookies.js";
import { saveRefreshToken, type NewRefreshToken } from "./store.js";
import {
  REFRESH_TOKEN_MS,
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  type SignIn,
} from "./tokens.js";

// A new refresh token and what the database stores for it: only the hash, never the token.
export function newRefreshTokenRecord(now: Date): NewRefreshToken & { refreshToken: string } {
  const refreshToken = newRefreshToken();
  return {
    refreshToken,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_MS),
  };
}

async function signInTokens(
  user: SignedInUser,
  refreshToken: string,
  deps: AppDeps,
  now: Date,
): Promise<SignIn> {
  return { accessToken: await signAccessToken(user, deps.jwtSecret, now), refreshToken };
}

export async function createSignIn(db: Db, user: SignedInUser, deps: AppDeps): Promise<SignIn> {
  const now = deps.now();
  const { refreshToken, tokenHash, expiresAt } = newRefreshTokenRecord(now);
  await saveRefreshToken(db, { userId: user.id, tokenHash, expiresAt });
  return signInTokens(user, refreshToken, deps, now);
}

// For a refresh token that is already saved: it goes out with a new access token.
export async function finishSignIn(
  res: Response,
  user: SignedInUser,
  refreshToken: string,
  deps: AppDeps,
  now: Date,
): Promise<void> {
  setSignInCookies(res, await signInTokens(user, refreshToken, deps, now), deps);
}

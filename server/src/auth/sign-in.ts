import type { NextFunction, Request, Response } from "express";
import type { AppDeps } from "../app.js";
import type { Db } from "../db.js";
import { ErrorCode, HttpError } from "../errors.js";
import { AUTH_PATH } from "../paths.js";
import { Role } from "../roles.js";
import { saveRefreshToken, type NewRefreshToken } from "./store.js";
import {
  ACCESS_TOKEN_MINUTES,
  REFRESH_TOKEN_DAYS,
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "./tokens.js";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function notSignedIn() {
  return new HttpError(401, ErrorCode.UNAUTHENTICATED, "Please log in.");
}

// The server only trusts the user id inside the access token cookie.
export async function signedInUser(req: Request, deps: AppDeps): Promise<{ id: string; role: Role }> {
  try {
    return await verifyAccessToken(req.cookies.access_token, deps.jwtSecret, deps.now());
  } catch {
    throw notSignedIn();
  }
}

const wrongRoleMessage: Record<Role, string> = {
  [Role.PROFESSIONAL]: "Only professionals can do this.",
  [Role.MEMBER]: "Only members can do this.",
};

// Guards every route on the router it is used on, so a new route can't forget the check.
export function requireRole(deps: AppDeps, role: Role) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await signedInUser(req, deps);
    if (user.role !== role) throw new HttpError(403, ErrorCode.WRONG_ROLE, wrongRoleMessage[role]);
    res.locals.user = user;
    next();
  };
}

// For routes open to both roles. Each person still only reaches their own records.
export function requireSignedIn(deps: AppDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.locals.user = await signedInUser(req, deps);
    next();
  };
}

// Only valid behind requireRole or requireSignedIn, which put the user on res.locals.
export function currentUser(res: Response): { id: string; role: Role } {
  if (!res.locals.user) throw new Error("currentUser needs requireRole or requireSignedIn to run first");
  return res.locals.user;
}

function cookieOptions(deps: AppDeps) {
  return { httpOnly: true, sameSite: "lax" as const, secure: deps.secureCookies };
}

export type SignIn = { accessToken: string; refreshToken: string };

// A new refresh token and what the database stores for it: only the hash, never the token.
export function newRefreshTokenRecord(now: Date): NewRefreshToken & { refreshToken: string } {
  const refreshToken = newRefreshToken();
  return {
    refreshToken,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_DAYS * DAY_MS),
  };
}

async function signInTokens(
  user: { id: string; role: Role },
  refreshToken: string,
  deps: AppDeps,
  now: Date,
): Promise<SignIn> {
  return { accessToken: await signAccessToken(user, deps.jwtSecret, now), refreshToken };
}

export async function createSignIn(db: Db, user: { id: string; role: Role }, deps: AppDeps): Promise<SignIn> {
  const now = deps.now();
  const { refreshToken, tokenHash, expiresAt } = newRefreshTokenRecord(now);
  await saveRefreshToken(db, { userId: user.id, tokenHash, expiresAt });
  return signInTokens(user, refreshToken, deps, now);
}

export function setSignInCookies(res: Response, tokens: SignIn, deps: AppDeps): void {
  const cookie = cookieOptions(deps);
  res.cookie("access_token", tokens.accessToken, {
    ...cookie,
    path: "/",
    maxAge: ACCESS_TOKEN_MINUTES * MINUTE_MS,
  });
  res.cookie("refresh_token", tokens.refreshToken, {
    ...cookie,
    path: AUTH_PATH,
    maxAge: REFRESH_TOKEN_DAYS * DAY_MS,
  });
}

// For a refresh token that is already saved: it goes out with a new access token.
export async function finishSignIn(
  res: Response,
  user: { id: string; role: Role },
  refreshToken: string,
  deps: AppDeps,
  now: Date,
): Promise<void> {
  setSignInCookies(res, await signInTokens(user, refreshToken, deps, now), deps);
}

// Browsers only drop a cookie when the path and flags match the ones it was set with.
export function clearSignIn(res: Response, deps: AppDeps): void {
  const cookie = cookieOptions(deps);
  res.clearCookie("access_token", { ...cookie, path: "/" });
  res.clearCookie("refresh_token", { ...cookie, path: AUTH_PATH });
}

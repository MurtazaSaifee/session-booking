import type { Response } from "express";
import type { AppDeps } from "../app.js";
import { AUTH_PATH } from "../paths.js";
import { ACCESS_TOKEN_MS, REFRESH_TOKEN_MS, type SignIn } from "./tokens.js";

function cookieOptions(deps: AppDeps) {
  return { httpOnly: true, sameSite: "lax" as const, secure: deps.secureCookies };
}

export function setSignInCookies(res: Response, tokens: SignIn, deps: AppDeps): void {
  const cookie = cookieOptions(deps);
  res.cookie("access_token", tokens.accessToken, {
    ...cookie,
    path: "/",
    maxAge: ACCESS_TOKEN_MS,
  });
  res.cookie("refresh_token", tokens.refreshToken, {
    ...cookie,
    path: AUTH_PATH,
    maxAge: REFRESH_TOKEN_MS,
  });
}

// Browsers only drop a cookie when the path and flags match the ones it was set with.
export function clearSignIn(res: Response, deps: AppDeps): void {
  const cookie = cookieOptions(deps);
  res.clearCookie("access_token", { ...cookie, path: "/" });
  res.clearCookie("refresh_token", { ...cookie, path: AUTH_PATH });
}

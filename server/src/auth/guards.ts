import type { NextFunction, Request, Response } from "express";
import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role } from "../roles.js";
import { verifyAccessToken } from "./tokens.js";

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

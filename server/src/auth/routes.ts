import express, { type Request, type Response } from "express";
import type { AppDeps } from "../app.js";
import type { Db } from "../db.js";
import { HttpError } from "../errors.js";
import { AUTH_PATH } from "../paths.js";
import { Role } from "../roles.js";
import { parseBody } from "../validation.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { loginSchema, signupSchema } from "./schemas.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  redeemRefreshToken,
  revokeRefreshToken,
  saveRefreshToken,
  type PublicUser,
} from "./store.js";
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

// Checked against when the email is unknown, so a login takes about as long either way.
const dummyHash = hashPassword("not-the-password");

function publicUser(row: PublicUser): PublicUser {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    timezone: row.timezone,
    title: row.title,
    bio: row.bio,
  };
}

function notSignedIn() {
  return new HttpError(401, "UNAUTHENTICATED", "Please log in.");
}

// The server only trusts the user id inside the access token cookie.
export async function signedInUser(req: Request, deps: AppDeps): Promise<{ id: string; role: Role }> {
  try {
    return await verifyAccessToken(req.cookies.access_token, deps.jwtSecret, deps.now());
  } catch {
    throw notSignedIn();
  }
}

function cookieOptions(deps: AppDeps) {
  return { httpOnly: true, sameSite: "lax" as const, secure: deps.secureCookies };
}

async function createSignIn(
  db: Db,
  user: { id: string; role: Role },
  deps: AppDeps,
): Promise<{ accessToken: string; refreshToken: string }> {
  const now = deps.now();
  const accessToken = await signAccessToken(user, deps.jwtSecret, now);
  const refreshToken = newRefreshToken();
  await saveRefreshToken(db, {
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_DAYS * DAY_MS),
  });
  return { accessToken, refreshToken };
}

function setSignInCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  deps: AppDeps,
): void {
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

// Browsers only drop a cookie when the path and flags match the ones it was set with.
function clearSignIn(res: Response, deps: AppDeps): void {
  const cookie = cookieOptions(deps);
  res.clearCookie("access_token", { ...cookie, path: "/" });
  res.clearCookie("refresh_token", { ...cookie, path: AUTH_PATH });
}

export function authRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.post("/signup", async (req, res) => {
    const input = parseBody(signupSchema, req.body);
    const passwordHash = await hashPassword(input.password);
    const details =
      input.role === Role.PROFESSIONAL ? { title: input.title, bio: input.bio } : { title: null, bio: null };

    const row = await createUser(deps.db, {
      role: input.role,
      name: input.name,
      email: input.email,
      passwordHash,
      timezone: input.timezone,
      title: details.title,
      bio: details.bio,
    });
    if (!row) throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");

    setSignInCookies(res, await createSignIn(deps.db, row, deps), deps);
    res.status(201).json({ user: publicUser(row) });
  });

  router.post("/login", async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const row = await findUserByEmail(deps.db, email);
    const passwordOk = await verifyPassword(password, row ? row.password_hash : await dummyHash);

    if (!row || !passwordOk) {
      throw new HttpError(401, "BAD_CREDENTIALS", "Email or password is incorrect.");
    }

    setSignInCookies(res, await createSignIn(deps.db, row, deps), deps);
    res.json({ user: publicUser(row) });
  });

  router.get("/me", async (req, res) => {
    const { id } = await signedInUser(req, deps);
    const row = await findUserById(deps.db, id);
    if (!row) throw notSignedIn();

    res.json({ user: publicUser(row) });
  });

  router.post("/refresh", async (req, res) => {
    const token = req.cookies.refresh_token;
    // Revoking the old token and saving the new one succeed or fail together.
    const result =
      typeof token === "string"
        ? await deps.db.transaction(async (trx) => {
            const user = await redeemRefreshToken(trx, hashRefreshToken(token), deps.now());
            return user && { user, tokens: await createSignIn(trx, user, deps) };
          })
        : null;
    if (!result) {
      clearSignIn(res, deps);
      throw notSignedIn();
    }

    setSignInCookies(res, result.tokens, deps);
    res.json({ user: publicUser(result.user) });
  });

  router.post("/logout", async (req, res) => {
    const token = req.cookies.refresh_token;
    if (typeof token === "string") {
      await revokeRefreshToken(deps.db, hashRefreshToken(token), deps.now());
    }
    clearSignIn(res, deps);
    res.status(204).end();
  });

  return router;
}

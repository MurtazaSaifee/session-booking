import express, { type Request, type Response } from "express";
import { IANAZone } from "luxon";
import { z } from "zod";
import type { AppDeps } from "../app.js";
import { HttpError } from "../errors.js";
import { parseBody } from "../validation.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import {
  ACCESS_TOKEN_MINUTES,
  REFRESH_TOKEN_DAYS,
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
  type Role,
} from "./tokens.js";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const API_V1 = "/api/v1";
export const AUTH_PATH = `${API_V1}/auth`;

const publicColumns = "id, role, name, email, timezone, title, bio";

type PublicUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  timezone: string;
  title: string | null;
  bio: string | null;
};

type UserRow = PublicUser & { password_hash: string };

const common = {
  name: z.string("Please enter your name.").trim().min(1, "Please enter your name.").max(100, "Name must be 100 characters or fewer."),
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

const signupSchema = z.discriminatedUnion(
  "role",
  [
    z.object({ role: z.literal("member"), ...common }),
    z.object({ role: z.literal("professional"), ...common, ...professionalFields }),
  ],
  "Please choose member or professional.",
);

const loginSchema = z.object({
  email: z.string("Please enter your email address.").min(1, "Please enter your email address."),
  password: z.string("Please enter your password.").min(1, "Please enter your password."),
});

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

function emailTaken(err: unknown): boolean {
  const pgError = err as { code?: string; constraint?: string };
  return pgError.code === "23505" && pgError.constraint === "users_email_key";
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

async function startSignIn(res: Response, user: { id: string; role: Role }, deps: AppDeps): Promise<void> {
  const now = deps.now();
  const accessToken = await signAccessToken(user, deps.jwtSecret, now);
  const refreshToken = newRefreshToken();
  await deps.db.query("insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)", [
    user.id,
    hashRefreshToken(refreshToken),
    new Date(now.getTime() + REFRESH_TOKEN_DAYS * DAY_MS),
  ]);

  const cookie = cookieOptions(deps);
  res.cookie("access_token", accessToken, { ...cookie, path: "/", maxAge: ACCESS_TOKEN_MINUTES * MINUTE_MS });
  res.cookie("refresh_token", refreshToken, { ...cookie, path: AUTH_PATH, maxAge: REFRESH_TOKEN_DAYS * DAY_MS });
}

// Browsers only drop a cookie when the path and flags match the ones it was set with.
function clearSignIn(res: Response, deps: AppDeps): void {
  const cookie = cookieOptions(deps);
  res.clearCookie("access_token", { ...cookie, path: "/" });
  res.clearCookie("refresh_token", { ...cookie, path: AUTH_PATH });
}

// The refresh token is single-use, so a stolen copy stops working once the real user refreshes.
// The update revokes and reads in one statement, so two racing refreshes can't both win.
async function redeemRefreshToken(token: string, deps: AppDeps): Promise<PublicUser | null> {
  const revoked = await deps.db.query<{ user_id: string }>(
    `update refresh_tokens set revoked_at = $2
     where token_hash = $1 and revoked_at is null and expires_at > $2
     returning user_id`,
    [hashRefreshToken(token), deps.now()],
  );
  const userId = revoked.rows[0]?.user_id;
  if (!userId) return null;

  const result = await deps.db.query<PublicUser>(`select ${publicColumns} from users where id = $1`, [userId]);
  return result.rows[0] ?? null;
}

export function authRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.post("/signup", async (req, res) => {
    const input = parseBody(signupSchema, req.body);
    const passwordHash = await hashPassword(input.password);
    const details = input.role === "professional" ? { title: input.title, bio: input.bio } : { title: null, bio: null };

    let row: PublicUser;
    try {
      const result = await deps.db.query<PublicUser>(
        `insert into users (role, name, email, password_hash, timezone, title, bio)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning ${publicColumns}`,
        [input.role, input.name, input.email, passwordHash, input.timezone, details.title, details.bio],
      );
      row = result.rows[0];
    } catch (err) {
      if (emailTaken(err)) {
        throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists.");
      }
      throw err;
    }

    await startSignIn(res, row, deps);
    res.status(201).json({ user: publicUser(row) });
  });

  router.post("/login", async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const result = await deps.db.query<UserRow>(
      `select ${publicColumns}, password_hash from users where lower(email) = lower($1)`,
      [email],
    );
    const row = result.rows[0];
    const passwordOk = await verifyPassword(password, row ? row.password_hash : await dummyHash);

    if (!row || !passwordOk) {
      throw new HttpError(401, "BAD_CREDENTIALS", "Email or password is incorrect.");
    }

    await startSignIn(res, row, deps);
    res.json({ user: publicUser(row) });
  });

  router.get("/me", async (req, res) => {
    const { id } = await signedInUser(req, deps);
    const result = await deps.db.query<PublicUser>(`select ${publicColumns} from users where id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw notSignedIn();

    res.json({ user: publicUser(row) });
  });

  router.post("/refresh", async (req, res) => {
    const token = req.cookies.refresh_token;
    const user = typeof token === "string" ? await redeemRefreshToken(token, deps) : null;
    if (!user) {
      clearSignIn(res, deps);
      throw notSignedIn();
    }

    await startSignIn(res, user, deps);
    res.json({ user: publicUser(user) });
  });

  router.post("/logout", async (req, res) => {
    const token = req.cookies.refresh_token;
    if (typeof token === "string") {
      await deps.db.query(
        "update refresh_tokens set revoked_at = $2 where token_hash = $1 and revoked_at is null",
        [hashRefreshToken(token), deps.now()],
      );
    }
    clearSignIn(res, deps);
    res.status(204).end();
  });

  return router;
}

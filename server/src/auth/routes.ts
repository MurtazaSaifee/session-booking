import express from "express";
import type { AppDeps } from "../app.js";
import { ErrorCode, HttpError } from "../errors.js";
import { Role } from "../roles.js";
import { parseBody } from "../validation.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { loginSchema, signupSchema } from "./schemas.js";
import {
  clearSignIn,
  createSignIn,
  newRefreshTokenRecord,
  notSignedIn,
  setSignInCookies,
  signedInUser,
  signInTokens,
} from "./session.js";
import {
  createUserWithRefreshToken,
  findUserByEmail,
  findUserById,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./store.js";
import { hashRefreshToken } from "./tokens.js";

// Checked against when the email is unknown, so a login takes about as long either way.
const dummyHash = hashPassword("not-the-password");

export function authRoutes(deps: AppDeps): express.Router {
  const router = express.Router();

  router.post("/signup", async (req, res) => {
    const input = parseBody(signupSchema, req.body);
    const passwordHash = await hashPassword(input.password);
    const details =
      input.role === Role.PROFESSIONAL ? { title: input.title, bio: input.bio } : { title: null, bio: null };

    const now = deps.now();
    const refresh = newRefreshTokenRecord(now);
    const user = await createUserWithRefreshToken(
      deps.db,
      {
        role: input.role,
        name: input.name,
        email: input.email,
        passwordHash,
        timezone: input.timezone,
        title: details.title,
        bio: details.bio,
      },
      refresh,
    );
    if (!user) throw new HttpError(409, ErrorCode.EMAIL_TAKEN, "An account with this email already exists.");

    setSignInCookies(res, await signInTokens(user, refresh.refreshToken, deps, now), deps);
    res.status(201).json({ user });
  });

  router.post("/login", async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const found = await findUserByEmail(deps.db, email);
    const passwordOk = await verifyPassword(password, found ? found.passwordHash : await dummyHash);

    if (!found || !passwordOk) {
      throw new HttpError(401, ErrorCode.BAD_CREDENTIALS, "Email or password is incorrect.");
    }

    setSignInCookies(res, await createSignIn(deps.db, found.user, deps), deps);
    res.json({ user: found.user });
  });

  router.get("/me", async (req, res) => {
    const { id } = await signedInUser(req, deps);
    const row = await findUserById(deps.db, id);
    if (!row) throw notSignedIn();

    res.json({ user: row });
  });

  router.post("/refresh", async (req, res) => {
    const token = req.cookies.refresh_token;
    const now = deps.now();
    const refresh = newRefreshTokenRecord(now);
    const user =
      typeof token === "string"
        ? await rotateRefreshToken(deps.db, hashRefreshToken(token), refresh, now)
        : null;
    if (!user) {
      clearSignIn(res, deps);
      throw notSignedIn();
    }

    setSignInCookies(res, await signInTokens(user, refresh.refreshToken, deps, now), deps);
    res.json({ user });
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

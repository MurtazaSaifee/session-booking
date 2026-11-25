import request from "supertest";
import { afterAll, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ErrorCode } from "../src/errors.js";
import { API_V1 } from "../src/paths.js";
import { extractViewerIp } from "../src/security.js";
import { TEST_JWT_SECRET } from "./app.js";
import { createTestDb } from "./db.js";

const db = createTestDb();

afterAll(() => db.destroy());

it("extracts viewer IP from CloudFront-Viewer-Address safely", () => {
  expect(extractViewerIp("203.0.113.10:54321")).toBe("203.0.113.10");
  expect(extractViewerIp("[2001:db8::1]:54321")).toBe("2001:db8::1");
  expect(extractViewerIp("2001:db8::1:54321")).toBe("2001:db8::1");
  expect(extractViewerIp("198.51.100.4")).toBe("198.51.100.4");
  expect(extractViewerIp("not-an-ip:1234")).toBeNull();
  expect(extractViewerIp(undefined)).toBeNull();
});

it("blocks direct API requests when originVerifySecret does not match", async () => {
  const app = createApp({
    db,
    now: () => new Date(),
    jwtSecret: TEST_JWT_SECRET,
    secureCookies: false,
    originVerifySecret: "super-secret-header",
  });

  const missing = await request(app).get(`${API_V1}/health`);
  expect(missing.status).toBe(403);
  expect(missing.body).toEqual({ error: ErrorCode.FORBIDDEN, message: "Forbidden." });

  const wrong = await request(app).get(`${API_V1}/health`).set("x-origin-verify", "wrong-secret");
  expect(wrong.status).toBe(403);

  const valid = await request(app).get(`${API_V1}/health`).set("x-origin-verify", "super-secret-header");
  expect(valid.status).toBe(200);
  expect(valid.headers["x-powered-by"]).toBeUndefined();
});

it("rejects oversized JSON bodies with 413", async () => {
  const app = createApp({
    db,
    now: () => new Date(),
    jwtSecret: TEST_JWT_SECRET,
    secureCookies: false,
  });

  const oversized = { email: "a@example.com", password: "x".repeat(20_000) };
  const res = await request(app).post(`${API_V1}/auth/login`).send(oversized);
  expect(res.status).toBe(413);
  expect(res.body).toEqual({ error: ErrorCode.VALIDATION, message: "Request body is too large." });
});

it("rate limits repeated auth attempts per viewer IP", async () => {
  const app = createApp({
    db,
    now: () => new Date(),
    jwtSecret: TEST_JWT_SECRET,
    secureCookies: false,
    originVerifySecret: "cf-secret",
    rateLimit: true,
  });

  for (let i = 0; i < 15; i += 1) {
    const res = await request(app)
      .post(`${API_V1}/auth/login`)
      .set("x-origin-verify", "cf-secret")
      .set("cloudfront-viewer-address", "198.51.100.77:4000")
      .send({ email: "", password: "" });
    expect(res.status).toBe(400);
  }

  const limited = await request(app)
    .post(`${API_V1}/auth/login`)
    .set("x-origin-verify", "cf-secret")
    .set("cloudfront-viewer-address", "198.51.100.77:4001")
    .send({ email: "", password: "" });
  expect(limited.status).toBe(429);
  expect(limited.body).toEqual({
    error: ErrorCode.RATE_LIMITED,
    message: "Too many requests. Please try again later.",
  });

  // A different IP is still allowed.
  const otherIp = await request(app)
    .post(`${API_V1}/auth/login`)
    .set("x-origin-verify", "cf-secret")
    .set("cloudfront-viewer-address", "198.51.100.88:4000")
    .send({ email: "", password: "" });
  expect(otherIp.status).toBe(400);
});

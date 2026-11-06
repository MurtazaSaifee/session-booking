import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ErrorCode } from "../src/errors.js";
import { createTestDb } from "./db.js";

const db = createTestDb();
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "static-test-"));
  await writeFile(
    path.join(tempDir, "index.html"),
    "<!doctype html><html><body><div id='root'>Session Booking</div></body></html>",
  );
  await mkdir(path.join(tempDir, "assets"));
  await writeFile(path.join(tempDir, "assets", "test.css"), "body { color: #0f4c5c; }");
});

afterAll(async () => {
  await db.destroy();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

it("serves static assets and falls back to index.html for client routes when staticDir is provided", async () => {
  const app = createApp({
    db,
    now: () => new Date(),
    jwtSecret: "test-secret",
    secureCookies: false,
    staticDir: tempDir,
  });

  // Root serves index.html
  const rootRes = await request(app).get("/");
  expect(rootRes.status).toBe(200);
  expect(rootRes.headers["content-type"]).toContain("text/html");
  expect(rootRes.text).toContain("Session Booking");

  // Static asset in assets/
  const assetRes = await request(app).get("/assets/test.css");
  expect(assetRes.status).toBe(200);
  expect(assetRes.headers["content-type"]).toContain("text/css");
  expect(assetRes.text).toContain("#0f4c5c");

  // SPA client routes return index.html
  const loginRes = await request(app).get("/login");
  expect(loginRes.status).toBe(200);
  expect(loginRes.headers["content-type"]).toContain("text/html");
  expect(loginRes.text).toContain("Session Booking");

  const professionalsRes = await request(app).get("/professionals");
  expect(professionalsRes.status).toBe(200);
  expect(professionalsRes.headers["content-type"]).toContain("text/html");

  // API route works and is not intercepted by static middleware
  const healthRes = await request(app).get("/api/v1/health");
  expect(healthRes.status).toBe(200);
  expect(healthRes.body).toMatchObject({ status: "ok" });

  // Nonexistent API route returns 404 JSON, NOT index.html
  const apiNotFoundRes = await request(app).get("/api/v1/missing");
  expect(apiNotFoundRes.status).toBe(404);
  expect(apiNotFoundRes.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "Not found." });

  // Non-GET requests do not fall back to index.html
  const postRes = await request(app).post("/login").send({});
  expect(postRes.status).toBe(404);
});

it("behaves as a pure API server when staticDir is omitted", async () => {
  const app = createApp({
    db,
    now: () => new Date(),
    jwtSecret: "test-secret",
    secureCookies: false,
  });

  const apiRes = await request(app).get("/api/v1/health");
  expect(apiRes.status).toBe(200);

  const missingRes = await request(app).get("/api/v1/missing");
  expect(missingRes.status).toBe(404);
  expect(missingRes.body.error).toBe(ErrorCode.NOT_FOUND);

  const nonApiRes = await request(app).get("/login");
  expect(nonApiRes.status).toBe(404);
});

import request from "supertest";
import { afterAll, expect, it } from "vitest";
import type { Db } from "../src/db.js";
import { createTestApp } from "./app.js";
import { createTestDb } from "./db.js";

const now = () => new Date("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createTestApp(db, now);

afterAll(() => db.end());

it("GET /api/health returns ok with the injected time", async () => {
  const res = await request(app).get("/api/health");

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok", time: "2027-01-15T09:00:00.000Z" });
});

it("GET /api/health returns 503 when the database can't be reached", async () => {
  const brokenDb = { query: () => Promise.reject(new Error("connection refused")) } as unknown as Db;
  const brokenApp = createTestApp(brokenDb, now);

  const res = await request(brokenApp).get("/api/health");

  expect(res.status).toBe(503);
  expect(res.body).toEqual({ error: "DATABASE_UNAVAILABLE", message: "Can't reach the database." });
});

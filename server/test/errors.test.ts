import request from "supertest";
import { expect, it } from "vitest";
import type { Db } from "../src/db.js";
import { ErrorCode } from "../src/errors.js";
import { createTestApp } from "./app.js";

const now = () => new Date("2027-01-15T09:00:00Z");

// None of these tests touch the database.
const db = {} as Db;
const app = createTestApp(db, now);

it("unknown API routes return a JSON 404", async () => {
  const res = await request(app).get("/api/v1/nope");

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "Not found." });
});

it("unknown API versions return a JSON 404", async () => {
  const res = await request(app).get("/api/v2/health");

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "Not found." });
});

it("mutating requests that aren't JSON return 415", async () => {
  const res = await request(app).post("/api/v1/nope").type("form").send("a=1");

  expect(res.status).toBe(415);
  expect(res.body).toEqual({
    error: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
    message: "Requests must be sent as JSON.",
  });
});

it("invalid JSON bodies return 400", async () => {
  const res = await request(app).post("/api/v1/nope").set("Content-Type", "application/json").send("{bad");

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: ErrorCode.VALIDATION, message: "The request body isn't valid JSON." });
});

it("valid JSON passes the gate and reaches the 404", async () => {
  const res = await request(app).post("/api/v1/nope").send({});

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: ErrorCode.NOT_FOUND, message: "Not found." });
});

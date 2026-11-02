import request from "supertest";
import { afterAll, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDb } from "./db.js";

const now = () => new Date("2027-01-15T09:00:00Z");

const db = createTestDb();
const app = createApp({ db, now });

afterAll(() => db.end());

it("unknown API routes return a JSON 404", async () => {
  const res = await request(app).get("/api/nope");

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "NOT_FOUND", message: "Not found." });
});

it("mutating requests that aren't JSON return 415", async () => {
  const res = await request(app).post("/api/nope").type("form").send("a=1");

  expect(res.status).toBe(415);
  expect(res.body).toEqual({ error: "VALIDATION", message: "Requests must be sent as JSON." });
});

it("invalid JSON bodies return 400", async () => {
  const res = await request(app).post("/api/nope").set("Content-Type", "application/json").send("{bad");

  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: "VALIDATION", message: "The request body isn't valid JSON." });
});

it("valid JSON passes the gate and reaches the 404", async () => {
  const res = await request(app).post("/api/nope").send({});

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "NOT_FOUND", message: "Not found." });
});

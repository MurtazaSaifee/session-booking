import { expect, it } from "vitest";
import { dbFromEnv, parsePoolMax } from "../src/db.js";

it("uses the default when the setting is absent", () => {
  expect(parsePoolMax(undefined)).toBe(10);
});

it("uses the setting when it is given", () => {
  expect(parsePoolMax("3")).toBe(3);
});

it.each(["0", "-1", "2.5", "many", ""])("refuses %j at start-up", (value) => {
  expect(() => parsePoolMax(value)).toThrow("DB_POOL_MAX must be a positive whole number");
});

it("refuses to start without a database address", () => {
  expect(() => dbFromEnv({})).toThrow("DATABASE_URL is not set");
});

it("refuses to start with a bad pool setting", () => {
  expect(() => dbFromEnv({ DATABASE_URL: "postgres://unused", DB_POOL_MAX: "many" })).toThrow(
    "DB_POOL_MAX must be a positive whole number",
  );
});

import { expect, it } from "vitest";
import { shouldSeedDemoData } from "../src/seed.js";

it.each([
  ["production by default", { NODE_ENV: "production" }, false],
  ["production when asked for", { NODE_ENV: "production", SEED_DEMO_DATA: "true" }, true],
  ["production with any other value", { NODE_ENV: "production", SEED_DEMO_DATA: "yes" }, false],
  ["development by default", { NODE_ENV: "development" }, true],
  ["no environment set", {}, true],
  ["development when switched off", { NODE_ENV: "development", SEED_DEMO_DATA: "false" }, false],
])("%s", (_name, env, expected) => {
  expect(shouldSeedDemoData(env)).toBe(expected);
});

import { expect, it } from "vitest";
import { parseCheckIntervalMs } from "../src/background-checks.js";

it("checks every 60 seconds unless the setting says otherwise", () => {
  expect(parseCheckIntervalMs(undefined)).toBe(60_000);
  expect(parseCheckIntervalMs("5")).toBe(5_000);
});

it.each(["", "0", "-1", "soon"])("refuses a check interval of %j", (seconds) => {
  expect(() => parseCheckIntervalMs(seconds)).toThrow("BACKGROUND_CHECK_SECONDS");
});

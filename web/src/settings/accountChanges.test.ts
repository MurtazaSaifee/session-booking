import { expect, it } from "vitest";
import { accountChanges } from "./accountChanges";

const saved = { name: "Nora Quill", timezone: "Asia/Kuala_Lumpur" };

it("sends nothing when nothing changed", () => {
  expect(accountChanges(saved, "Nora Quill", "Asia/Kuala_Lumpur")).toEqual({});
});

it("sends only the name when only the name changed", () => {
  expect(accountChanges(saved, "Nora Hale", "Asia/Kuala_Lumpur")).toEqual({ name: "Nora Hale" });
});

it("sends only the timezone when only the timezone changed", () => {
  expect(accountChanges(saved, "Nora Quill", "Asia/Singapore")).toEqual({ timezone: "Asia/Singapore" });
});

it("ignores spaces around the name", () => {
  expect(accountChanges(saved, "  Nora Quill  ", "Asia/Kuala_Lumpur")).toEqual({});
});

it("sends a blank name, so the server can say a name is needed", () => {
  expect(accountChanges(saved, "   ", "Asia/Kuala_Lumpur")).toEqual({ name: "" });
});

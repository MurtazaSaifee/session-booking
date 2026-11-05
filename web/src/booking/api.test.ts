import { expect, it } from "vitest";
import { ApiError } from "../api";
import { isBookingRefusal } from "./api";

it.each([
  { case: "a taken slot", err: new ApiError(409, "SLOT_TAKEN", "Taken."), expected: true },
  { case: "an unavailable slot", err: new ApiError(422, "SLOT_NOT_AVAILABLE", "No."), expected: true },
  { case: "a bad request", err: new ApiError(400, "VALIDATION", "Bad."), expected: false },
  { case: "a lost connection", err: new ApiError(0, "NETWORK", "Can't reach the API."), expected: false },
  { case: "an error that isn't from the API", err: new Error("Oops"), expected: false },
])("$case gives $expected", ({ err, expected }) => {
  expect(isBookingRefusal(err)).toBe(expected);
});

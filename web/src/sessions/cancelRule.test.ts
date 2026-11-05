import { describe, expect, it } from "vitest";
import { Role } from "../roles";
import { CancelledBy, SessionStatus, type MySession } from "./api";
import { CancelButtonState, cancelButtonState } from "./cancelRule";

const START = "2027-01-18T03:30:00.000Z";
const session: MySession = {
  id: "3f2b8c1e-7a4d-4e6f-9b1a-2c3d4e5f6a7b",
  otherPersonName: "Nora Quill",
  start: START,
  end: "2027-01-18T04:20:00.000Z",
  status: SessionStatus.BOOKED,
  cancelledBy: null,
};
const exactly24HoursBefore = new Date("2027-01-17T03:30:00.000Z");

describe("cancelButtonState for a member", () => {
  it("is enabled at exactly 24 hours before the start", () => {
    expect(cancelButtonState(session, Role.MEMBER, exactly24HoursBefore)).toBe(CancelButtonState.ENABLED);
  });

  it("is disabled one millisecond later", () => {
    const later = new Date(exactly24HoursBefore.getTime() + 1);
    expect(cancelButtonState(session, Role.MEMBER, later)).toBe(CancelButtonState.DISABLED);
  });

  it("is disabled while the session is in progress", () => {
    expect(cancelButtonState(session, Role.MEMBER, new Date("2027-01-18T03:40:00.000Z"))).toBe(
      CancelButtonState.DISABLED,
    );
  });

  it("is hidden once the session has ended", () => {
    expect(cancelButtonState(session, Role.MEMBER, new Date("2027-01-18T04:20:00.000Z"))).toBe(
      CancelButtonState.HIDDEN,
    );
  });
});

describe("cancelButtonState for a professional", () => {
  it.each([
    ["well ahead", "2027-01-01T00:00:00.000Z"],
    ["inside 24 hours", "2027-01-18T03:00:00.000Z"],
    ["after the session ended", "2027-02-01T00:00:00.000Z"],
  ])("is enabled %s", (_name, now) => {
    expect(cancelButtonState(session, Role.PROFESSIONAL, new Date(now))).toBe(CancelButtonState.ENABLED);
  });
});

it("is hidden for a session that is already cancelled", () => {
  const cancelled = { ...session, status: SessionStatus.CANCELLED, cancelledBy: CancelledBy.YOU };
  expect(cancelButtonState(cancelled, Role.PROFESSIONAL, exactly24HoursBefore)).toBe(
    CancelButtonState.HIDDEN,
  );
});

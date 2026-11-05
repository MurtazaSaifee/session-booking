import { api, ApiError } from "../api";

export type Slot = { start: string; end: string };

export async function getSlots(professionalId: string): Promise<Slot[]> {
  const { slots } = await api<{ slots: Slot[] }>(
    `/professionals/${encodeURIComponent(professionalId)}/slots`,
  );
  return slots;
}

// The server's answers that mean this time can't be booked, so the free times on screen are out of date.
const BOOKING_REFUSALS = ["SLOT_NOT_AVAILABLE", "SLOT_TAKEN", "MEMBER_OVERLAP"];

export function isBookingRefusal(err: unknown): err is ApiError {
  return err instanceof ApiError && BOOKING_REFUSALS.includes(err.code);
}

export async function bookSession(professionalId: string, start: string): Promise<void> {
  await api("/sessions", { method: "POST", body: { professionalId, start } });
}

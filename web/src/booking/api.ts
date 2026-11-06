import { api, ApiError } from "../api";

export type Slot = { start: string; end: string };

// `ignoreSessionId` is the session being moved, so its own time isn't hidden as busy.
export async function getSlots(professionalId: string, ignoreSessionId?: string): Promise<Slot[]> {
  const query = ignoreSessionId ? `?ignoreSessionId=${encodeURIComponent(ignoreSessionId)}` : "";
  const { slots } = await api<{ slots: Slot[] }>(
    `/professionals/${encodeURIComponent(professionalId)}/slots${query}`,
  );
  return slots;
}

// How the server says this time can't be booked, so the free times on screen are out of date.
const REFUSED_STATUSES = [409, 422];

export function isBookingRefusal(err: unknown): err is ApiError {
  return err instanceof ApiError && REFUSED_STATUSES.includes(err.status);
}

export async function bookSession(professionalId: string, start: string): Promise<void> {
  await api("/sessions", { method: "POST", body: { professionalId, start } });
}

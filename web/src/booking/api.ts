import { api } from "../api";

export type Slot = { start: string; end: string };

export async function getSlots(professionalId: string): Promise<Slot[]> {
  const { slots } = await api<{ slots: Slot[] }>(
    `/professionals/${encodeURIComponent(professionalId)}/slots`,
  );
  return slots;
}

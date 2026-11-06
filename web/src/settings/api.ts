import { api } from "../api";

export type Profile = { title: string | null; bio: string | null; minimumNoticeMinutes: number };

// Only the fields that changed, so another tab's edits to the other field survive.
export type ProfileChanges = { title?: string; bio?: string; minimumNoticeMinutes?: number };

// A working-hours range on the professional's own clock; weekday 1 is Monday.
export type TimeRange = { weekday: number; start: string; end: string };

export async function getProfile(): Promise<Profile> {
  const { profile } = await api<{ profile: Profile }>("/settings/profile");
  return profile;
}

export async function saveProfile(changes: ProfileChanges): Promise<Profile> {
  const { profile } = await api<{ profile: Profile }>("/settings/profile", {
    method: "PATCH",
    body: changes,
  });
  return profile;
}

export async function getHours(): Promise<TimeRange[]> {
  const { ranges } = await api<{ ranges: TimeRange[] }>("/settings/hours");
  return ranges;
}

export async function saveHours(ranges: TimeRange[]): Promise<TimeRange[]> {
  const { ranges: saved } = await api<{ ranges: TimeRange[] }>("/settings/hours", {
    method: "PUT",
    body: { ranges },
  });
  return saved;
}

import type { Profile, ProfileChanges } from "./api";

export function profileChanges(
  saved: Profile,
  title: string,
  bio: string,
  minimumNoticeMinutes: number,
): ProfileChanges {
  const changes: ProfileChanges = {};
  if (title.trim() !== (saved.title ?? "")) changes.title = title.trim();
  if (bio.trim() !== (saved.bio ?? "")) changes.bio = bio.trim();
  if (minimumNoticeMinutes !== saved.minimumNoticeMinutes)
    changes.minimumNoticeMinutes = minimumNoticeMinutes;
  return changes;
}

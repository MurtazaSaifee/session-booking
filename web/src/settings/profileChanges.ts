import type { Profile, ProfileChanges } from "./api";

export function profileChanges(saved: Profile, title: string, bio: string): ProfileChanges {
  const changes: ProfileChanges = {};
  if (title.trim() !== (saved.title ?? "")) changes.title = title.trim();
  if (bio.trim() !== (saved.bio ?? "")) changes.bio = bio.trim();
  return changes;
}

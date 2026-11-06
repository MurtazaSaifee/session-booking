export type AccountChanges = { name?: string; timezone?: string };

// Only what the person changed is sent, so saving a new name can never touch the timezone.
export function accountChanges(
  saved: { name: string; timezone: string },
  name: string,
  timezone: string,
): AccountChanges {
  const changes: AccountChanges = {};
  if (name.trim() !== saved.name) changes.name = name.trim();
  if (timezone !== saved.timezone) changes.timezone = timezone;
  return changes;
}

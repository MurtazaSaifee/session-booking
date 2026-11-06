export function formatNoticeDuration(minutes: number): string {
  if (minutes <= 0) return "No minimum notice (immediate booking allowed)";
  const days = Math.floor(minutes / (24 * 60));
  const remainingHours = Math.floor((minutes % (24 * 60)) / 60);
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];
  if (days === 1) parts.push("1 day");
  else if (days > 1) parts.push(`${days} days`);

  if (remainingHours === 1) parts.push("1 hour");
  else if (remainingHours > 1) parts.push(`${remainingHours} hours`);

  if (remainingMinutes === 1) parts.push("1 minute");
  else if (remainingMinutes > 1) parts.push(`${remainingMinutes} minutes`);

  return parts.join(" ");
}


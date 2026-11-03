// Where someone is based, from their time zone: "America/Argentina/Buenos_Aires" becomes "Buenos Aires".
export function placeName(timezone: string): string {
  const lastSegment = timezone.split("/").at(-1) ?? timezone;
  return lastSegment.replaceAll("_", " ");
}

// Where someone is based, from their time zone: "America/Argentina/Buenos_Aires" becomes "Buenos Aires".
export function placeName(timeZone: string): string {
  const lastSegment = timeZone.split("/").at(-1) ?? timeZone;
  return lastSegment.replaceAll("_", " ");
}

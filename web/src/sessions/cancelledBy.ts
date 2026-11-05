import type { MySession } from "./api";

export function cancelledBy(session: MySession): string {
  return session.cancelledByYou ? "Cancelled by you" : `Cancelled by ${session.otherPersonName}`;
}

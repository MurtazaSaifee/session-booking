import { CancelledBy, type MySession } from "./api";

export function cancelledLabel(session: MySession): string {
  if (session.cancelledBy === CancelledBy.YOU) return "Cancelled by you";
  if (session.cancelledBy === CancelledBy.OTHER_PERSON) return `Cancelled by ${session.otherPersonName}`;
  return "Cancelled";
}

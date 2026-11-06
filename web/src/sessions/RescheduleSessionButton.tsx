import { generatePath, useNavigate } from "react-router";
import { Role } from "../roles";
import type { MySession } from "./api";
import { CancelButtonState, cancelButtonState } from "./cancelRule";
import { RESCHEDULE_ROUTE } from "./route";
import { useNow } from "./useNow";

type RescheduleSessionButtonProps = { session: MySession; role: Role };

// Only members move sessions. The rule is the same as cancelling, and CancelSessionButton explains it.
export function RescheduleSessionButton({ session, role }: RescheduleSessionButtonProps) {
  const navigate = useNavigate();
  const now = useNow();
  if (role !== Role.MEMBER) return null;

  const state = cancelButtonState(session, role, now);
  if (state === CancelButtonState.HIDDEN) return null;

  return (
    <button
      type="button"
      className="secondary"
      disabled={state === CancelButtonState.DISABLED}
      onClick={() => navigate(generatePath(RESCHEDULE_ROUTE, { id: session.id }))}
    >
      Reschedule session
    </button>
  );
}

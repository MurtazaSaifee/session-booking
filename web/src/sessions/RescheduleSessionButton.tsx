import { generatePath, useNavigate } from "react-router";
import { Role } from "../roles";
import type { MySession } from "./api";
import { ChangeButtonState, changeButtonState } from "./changeRule";
import { RESCHEDULE_ROUTE } from "./route";
import { useNow } from "./useNow";

type RescheduleSessionButtonProps = { session: MySession; role: Role };

// Only members move sessions. The rule is the same as cancelling, and CancelSessionButton explains it.
export function RescheduleSessionButton({ session, role }: RescheduleSessionButtonProps) {
  const navigate = useNavigate();
  const now = useNow();
  if (role !== Role.MEMBER) return null;

  const state = changeButtonState(session, role, now);
  if (state === ChangeButtonState.HIDDEN) return null;

  return (
    <button
      type="button"
      className="secondary"
      disabled={state === ChangeButtonState.DISABLED}
      onClick={() => navigate(generatePath(RESCHEDULE_ROUTE, { id: session.id }))}
    >
      Reschedule session
    </button>
  );
}

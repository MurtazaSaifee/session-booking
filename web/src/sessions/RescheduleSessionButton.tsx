import { generatePath, useNavigate } from "react-router";
import { RescheduleIcon } from "../components/icons";
import { Role } from "../roles";
import type { MySession } from "./api";
import { ChangeButtonState } from "./changeRule";
import { RESCHEDULE_ROUTE } from "./route";

type RescheduleSessionButtonProps = { session: MySession; role: Role; state: ChangeButtonState };

// Only members move sessions.
export function RescheduleSessionButton({ session, role, state }: RescheduleSessionButtonProps) {
  const navigate = useNavigate();
  if (role !== Role.MEMBER || state === ChangeButtonState.HIDDEN) return null;

  return (
    <button
      type="button"
      className="secondary icon-button"
      aria-label="Reschedule session"
      title="Reschedule session"
      disabled={state === ChangeButtonState.DISABLED}
      onClick={() => navigate(generatePath(RESCHEDULE_ROUTE, { id: session.id }))}
    >
      <RescheduleIcon />
    </button>
  );
}

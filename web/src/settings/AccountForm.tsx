import { startTransition, useActionState, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api";
import { useAuth, type User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field } from "../components/Field";
import { TimeZoneSelect } from "../components/TimeZoneSelect";
import { Role } from "../roles";
import { accountChanges } from "./accountChanges";

type FormState = { error: string | null; status: string | null };

const TIMEZONE_HINT =
  "Your sessions and new reminders will show in this time zone. Notifications you already have keep their original times.";
const PROFESSIONAL_TIMEZONE_HINT = `${TIMEZONE_HINT} Your working hours keep the same clock times, so the times members can book will move. Sessions already booked won't move.`;

export function AccountForm({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [edited, setEdited] = useState(false);

  // Sync state if user prop updates without cascading effect renders
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    setName(user.name);
    setTimezone(user.timezone);
  }

  async function submit(): Promise<FormState> {
    const changes = accountChanges(user, name, timezone);
    if (Object.keys(changes).length === 0) {
      return { error: null, status: "No changes to save." };
    }

    try {
      await updateUser(changes);
      return { error: null, status: "Account settings saved." };
    } catch (err) {
      return { error: errorMessage(err), status: null };
    }
  }

  const [{ error, status }, formAction, isPending] = useActionState(submit, { error: null, status: null });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEdited(false);
    startTransition(() => formAction());
  }

  return (
    <div className="settings-section">
      <div className="section-header-block">
        <h2>Account & Time Zone</h2>
        <p className="hint">Manage your display name and time zone preferences.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="Display name">
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setEdited(true);
            }}
            required
            maxLength={100}
            placeholder="Your full name"
          />
        </Field>

        <Field label="Email address" hint="Your login email cannot be changed.">
          <input type="email" value={user.email} disabled className="input-disabled" />
        </Field>

        <Field
          label="Time zone"
          hint={user.role === Role.PROFESSIONAL ? PROFESSIONAL_TIMEZONE_HINT : TIMEZONE_HINT}
        >
          <TimeZoneSelect
            name="timezone"
            defaultValue={timezone}
            onChange={(zone) => {
              setEdited(true);
              setTimezone(zone);
            }}
          />
        </Field>

        <ErrorMessage message={error} />
        {status && !edited && (
          <p role="status" className="status">
            {status}
          </p>
        )}

        <button type="submit" className="submit" disabled={isPending}>
          Save account settings
        </button>
      </form>
    </div>
  );
}

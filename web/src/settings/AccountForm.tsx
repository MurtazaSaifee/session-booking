import { startTransition, useActionState, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api";
import { useAuth, type User } from "../auth/AuthProvider";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field } from "../components/Field";
import { TimeZoneSelect } from "../components/TimeZoneSelect";

type FormState = { error: string | null; status: string | null };

export function AccountForm({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [edited, setEdited] = useState(false);

  async function submit(_previous: FormState, formData: FormData): Promise<FormState> {
    const newName = String(formData.get("name") ?? "").trim();
    const newTimezone = String(formData.get("timezone") ?? "").trim();

    const changes: { name?: string; timezone?: string } = {};
    if (newName && newName !== user.name) changes.name = newName;
    if (newTimezone && newTimezone !== user.timezone) changes.timezone = newTimezone;

    if (Object.keys(changes).length === 0) {
      return { error: null, status: "No changes to save." };
    }

    try {
      await updateUser(changes);
      setName(newName || user.name);
      setTimezone(newTimezone || user.timezone);
      return { error: null, status: "Account settings saved." };
    } catch (err) {
      return { error: errorMessage(err), status: null };
    }
  }

  const [{ error, status }, formAction, isPending] = useActionState(submit, { error: null, status: null });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEdited(false);
    startTransition(() => formAction(new FormData(event.currentTarget)));
  }

  return (
    <div className="settings-section">
      <div className="section-header-block">
        <h2>Account & Time Zone</h2>
        <p className="hint">Manage your display name and time zone preferences.</p>
      </div>

      <form onSubmit={handleSubmit} onChange={() => setEdited(true)}>
        <Field label="Display name">
          <input
            name="name"
            defaultValue={name}
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
          hint="All sessions, working hours, and notifications will be displayed in this time zone."
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


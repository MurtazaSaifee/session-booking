import { startTransition, useActionState, useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field } from "../components/Field";
import { TimeZoneSelect, browserTimeZone } from "../components/TimeZoneSelect";
import { Role } from "../roles";
import { useAuth } from "./AuthProvider";
import { RolePicker } from "./RolePicker";

export function SignUpPage() {
  const { signUp } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role>(Role.MEMBER);
  const isProfessional = selectedRole === Role.PROFESSIONAL;

  async function submit(_previous: string | null, formData: FormData): Promise<string | null> {
    const get = (key: string) => String(formData.get(key) ?? "");
    const role = get("role") as Role;
    const details = role === Role.PROFESSIONAL ? { title: get("title"), bio: get("bio") } : {};
    try {
      await signUp({
        role,
        name: get("name"),
        email: get("email"),
        timezone: get("timezone"),
        password: get("password"),
        ...details,
      });
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  const [error, formAction, isPending] = useActionState(submit, null);

  // onSubmit, not a form action: an action would clear the fields after an error.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => formAction(new FormData(event.currentTarget)));
  }

  return (
    <section className="card">
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <RolePicker value={selectedRole} onChange={setSelectedRole} />
        <Field label="Name">
          <input name="name" autoComplete="name" required />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Time zone">
          <TimeZoneSelect name="timezone" defaultValue={browserTimeZone} />
        </Field>
        {isProfessional && (
          <>
            <Field label="Your role">
              <input name="title" placeholder="e.g. Counsellor" required />
            </Field>
            <Field label="Short bio">
              <textarea name="bio" required rows={4} />
            </Field>
          </>
        )}
        <ErrorMessage message={error} />
        <button type="submit" className="submit" disabled={isPending}>
          Sign up
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}

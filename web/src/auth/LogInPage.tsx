import { startTransition, useActionState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field } from "../components/Field";
import { useAuth } from "./AuthProvider";

export function LogInPage() {
  const { logIn } = useAuth();

  async function submit(_previous: string | null, formData: FormData): Promise<string | null> {
    try {
      await logIn(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Something went wrong.";
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
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <ErrorMessage message={error} />
        <button type="submit" className="submit" disabled={isPending}>
          Log in
        </button>
      </form>
      <p>
        New here? <Link to="/signup">Sign up</Link>
      </p>
    </section>
  );
}

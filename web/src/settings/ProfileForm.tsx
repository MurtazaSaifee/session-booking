import { startTransition, useActionState, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field } from "../components/Field";
import { useLoad } from "../useLoad";
import { getProfile, saveProfile, type Profile } from "./api";
import { profileChanges } from "./profileChanges";

type FormState = { error: string | null; status: string | null };

export function ProfileForm() {
  const { data: profile, error: loadError } = useLoad(getProfile);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!profile) return <p>Loading your profile…</p>;
  return <ProfileFields initial={profile} />;
}

function ProfileFields({ initial }: { initial: Profile }) {
  const [saved, setSaved] = useState(initial);
  // A status describes the last save, so it goes away once the fields change again.
  const [edited, setEdited] = useState(false);

  async function submit(_previous: FormState, formData: FormData): Promise<FormState> {
    const changes = profileChanges(
      saved,
      String(formData.get("title") ?? ""),
      String(formData.get("bio") ?? ""),
    );
    if (Object.keys(changes).length === 0) return { error: null, status: "No changes to save." };
    try {
      setSaved(await saveProfile(changes));
      return { error: null, status: "Saved." };
    } catch (err) {
      return { error: errorMessage(err), status: null };
    }
  }

  const [{ error, status }, formAction, isPending] = useActionState(submit, { error: null, status: null });

  // onSubmit, not a form action: an action would clear the fields after an error.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEdited(false);
    startTransition(() => formAction(new FormData(event.currentTarget)));
  }

  return (
    <>
      <h2>Profile</h2>
      <form onSubmit={handleSubmit} onChange={() => setEdited(true)}>
        <Field label="Your role">
          <input name="title" placeholder="e.g. Counsellor" defaultValue={saved.title ?? ""} required />
        </Field>
        <Field label="Short bio">
          <textarea name="bio" rows={4} defaultValue={saved.bio ?? ""} required />
        </Field>
        <ErrorMessage message={error} />
        {status && !edited && (
          <p role="status" className="status">
            {status}
          </p>
        )}
        <button type="submit" className="submit" disabled={isPending}>
          Save profile
        </button>
      </form>
    </>
  );
}

import { startTransition, useActionState, useState, type SubmitEvent } from "react";
import { errorMessage } from "../api";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field } from "../components/Field";
import { useLoad } from "../useLoad";
import { getProfile, saveProfile, type Profile } from "./api";
import { formatNoticeDuration } from "./noticeDuration";
import { profileChanges } from "./profileChanges";

type FormState = { error: string | null; status: string | null };

const NOTICE_PRESETS = [
  { label: "0m (No notice)", minutes: 0 },
  { label: "1 hour (60m)", minutes: 60 },
  { label: "2 hours (120m)", minutes: 120 },
  { label: "4 hours (240m)", minutes: 240 },
  { label: "1 day (1440m)", minutes: 1440 },
  { label: "2 days (2880m)", minutes: 2880 },
];

function formatScenarioTime(noticeMinutes: number): string {
  if (noticeMinutes <= 0) return "10:00 AM today (immediately)";
  const base = new Date();
  base.setHours(10, 0, 0, 0);
  const target = new Date(base.getTime() + noticeMinutes * 60 * 1000);

  const diffDays = Math.floor((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
  const timeStr = target.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  if (diffDays === 0) {
    return `${timeStr} today`;
  } else if (diffDays === 1) {
    return `${timeStr} tomorrow`;
  } else {
    return `${timeStr} (${diffDays} days later)`;
  }
}

export function ProfileForm() {
  const { data: profile, error: loadError } = useLoad(getProfile);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!profile) return <p>Loading your profile…</p>;
  return <ProfileFields initial={profile} />;
}

function ProfileFields({ initial }: { initial: Profile }) {
  const [saved, setSaved] = useState(initial);
  const [edited, setEdited] = useState(false);
  const [noticeMinutes, setNoticeMinutes] = useState(initial.minimumNoticeMinutes);

  async function submit(_previous: FormState, formData: FormData): Promise<FormState> {
    const changes = profileChanges(
      saved,
      String(formData.get("title") ?? ""),
      String(formData.get("bio") ?? ""),
      noticeMinutes,
    );
    if (Object.keys(changes).length === 0) return { error: null, status: "No changes to save." };
    try {
      const updated = await saveProfile(changes);
      setSaved(updated);
      setNoticeMinutes(updated.minimumNoticeMinutes);
      return { error: null, status: "Profile and booking notice saved." };
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

  function handlePresetClick(minutes: number) {
    setNoticeMinutes(minutes);
    setEdited(true);
  }

  return (
    <div className="settings-section">
      <div className="section-header-block">
        <h2>Professional Profile</h2>
        <p className="hint">This information is shown to members when they browse and book sessions.</p>
      </div>

      <form onSubmit={handleSubmit} onChange={() => setEdited(true)}>
        <Field label="Your role" hint="Your professional title shown in the directory.">
          <input name="title" placeholder="e.g. Counsellor" defaultValue={saved.title ?? ""} required />
        </Field>

        <Field label="Short bio" hint="A short introduction to your background and approach.">
          <textarea name="bio" rows={4} defaultValue={saved.bio ?? ""} required />
        </Field>

        <div className="notice-card">
          <div className="notice-card-header">
            <h3>Minimum Booking Notice</h3>
          </div>
          <p className="hint">
            How much advance notice you require before members can book or reschedule a session with you. Members are never offered slots starting sooner than this.
          </p>

          <div className="preset-toolbar-block">
            <span className="toolbar-label">Quick presets:</span>
            <div className="toolbar-buttons">
              {NOTICE_PRESETS.map((preset) => (
                <button
                  key={preset.minutes}
                  type="button"
                  className={`preset-pill ${noticeMinutes === preset.minutes ? "active" : ""}`}
                  onClick={() => handlePresetClick(preset.minutes)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Notice window (minutes)"
            hint={`Current window: ${formatNoticeDuration(noticeMinutes)}`}
          >
            <input
              name="minimumNoticeMinutes"
              type="number"
              min={0}
              step={1}
              value={noticeMinutes}
              onChange={(e) => {
                const val = Number(e.target.value);
                setNoticeMinutes(isNaN(val) ? 0 : val);
                setEdited(true);
              }}
              required
            />
          </Field>

          <div className="notice-scenario-preview">
            <span className="preview-icon">💡</span>
            <span className="preview-text">
              <strong>How it works:</strong> If you set notice to {formatNoticeDuration(noticeMinutes)}, a member looking for a session at 10:00 AM will only see slots starting at or after {formatScenarioTime(noticeMinutes)}.
            </span>
          </div>
        </div>

        <ErrorMessage message={error} />
        {status && !edited && (
          <p role="status" className="status">
            {status}
          </p>
        )}

        <button type="submit" className="submit" disabled={isPending}>
          Save profile & notice
        </button>
      </form>
    </div>
  );
}

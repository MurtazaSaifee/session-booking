import type { User } from "../auth/AuthProvider";
import { HoursEditor } from "./HoursEditor";
import { ProfileForm } from "./ProfileForm";

export function SettingsPage({ user }: { user: User }) {
  return (
    <section className="card">
      <h1>My hours and profile</h1>
      <ProfileForm />
      <HoursEditor timezone={user.timezone} />
    </section>
  );
}

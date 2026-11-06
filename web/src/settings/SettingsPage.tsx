import type { User } from "../auth/AuthProvider";
import { BackNav } from "../components/BackNav";
import { Role } from "../roles";
import { AccountForm } from "./AccountForm";
import { HoursEditor } from "./HoursEditor";
import { ProfileForm } from "./ProfileForm";

export function SettingsPage({ user }: { user: User }) {
  const isProfessional = user.role === Role.PROFESSIONAL;

  return (
    <section className="card">
      <BackNav to="/" label="My sessions" />
      <h1>{isProfessional ? "Settings & Profile" : "Account Settings"}</h1>

      <AccountForm user={user} />

      {isProfessional && (
        <>
          <ProfileForm />
          <HoursEditor timezone={user.timezone} />
        </>
      )}
    </section>
  );
}

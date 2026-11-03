import { Role } from "../roles";

const roleOptions = [
  { value: Role.MEMBER, label: "I'm looking for support" },
  { value: Role.PROFESSIONAL, label: "I'm a professional" },
];

export function RolePicker({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <fieldset>
      <legend>I'm here as</legend>
      <div className="roles">
        {roleOptions.map((option) => (
          <label key={option.value} className={value === option.value ? "role selected" : "role"}>
            <input
              type="radio"
              name="role"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

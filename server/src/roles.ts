export const Role = { MEMBER: "MEMBER", PROFESSIONAL: "PROFESSIONAL" } as const;
export type Role = (typeof Role)[keyof typeof Role];

export type SignedInUser = { id: string; role: Role };

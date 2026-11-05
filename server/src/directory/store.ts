import type { Db } from "../db.js";
import { PAGE_QUERY_LIMIT, toPage, type Page, type Position } from "../paging.js";
import { Role } from "../roles.js";

// Exactly what the directory may show: never the email or password hash.
export type Professional = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  timezone: string;
};

type UserRow = Professional & { role: Role };

const professionalColumns: (keyof Professional)[] = ["id", "name", "title", "bio", "timezone"];

export async function listProfessionals(db: Db, after?: Position): Promise<Page<Professional>> {
  const query = db<UserRow>("users")
    .select(professionalColumns)
    .where({ role: Role.PROFESSIONAL })
    .orderBy(["name", "id"])
    .limit(PAGE_QUERY_LIMIT);
  if (after) query.whereRaw("(name, id) > (?, ?)", [after.value, after.id]);
  const rows: Professional[] = await query;
  return toPage(rows, (row) => ({ value: row.name, id: row.id }));
}

export async function findProfessional(db: Db, id: string): Promise<Professional | undefined> {
  return db<UserRow>("users").select(professionalColumns).where({ id, role: Role.PROFESSIONAL }).first();
}

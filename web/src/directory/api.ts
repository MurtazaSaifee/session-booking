import { api } from "../api";
import type { Page } from "../usePager";

export type Professional = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  timezone: string;
};

export function listProfessionals(): Promise<Page<Professional>> {
  return api<Page<Professional>>("/professionals");
}

export function listNextProfessionals(cursor: string): Promise<Page<Professional>> {
  return api<Page<Professional>>(`/professionals?cursor=${encodeURIComponent(cursor)}`);
}

export async function getProfessional(id: string): Promise<Professional> {
  const { professional } = await api<{ professional: Professional }>(
    `/professionals/${encodeURIComponent(id)}`,
  );
  return professional;
}

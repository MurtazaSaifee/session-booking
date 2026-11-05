import { api } from "../api";

export type Professional = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  timezone: string;
};

export async function listProfessionals(): Promise<Professional[]> {
  const { items } = await api<{ items: Professional[] }>("/professionals");
  return items;
}

export async function getProfessional(id: string): Promise<Professional> {
  const { professional } = await api<{ professional: Professional }>(
    `/professionals/${encodeURIComponent(id)}`,
  );
  return professional;
}

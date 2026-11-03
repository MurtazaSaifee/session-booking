import { api } from "../api";

export type Professional = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  timezone: string;
};

export async function listProfessionals(): Promise<Professional[]> {
  const { professionals } = await api<{ professionals: Professional[] }>("/professionals");
  return professionals;
}

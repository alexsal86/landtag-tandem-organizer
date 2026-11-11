import type { KnowledgePerson } from "./types";

const PERSON_COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#cffafe",
  "#ffedd5",
  "#e2e8f0",
];

export function knowledgePersonColor(userId: string): string {
  let hash = 0;
  for (const character of userId)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[hash % PERSON_COLORS.length];
}

export function knowledgePersonInitials(name: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "?";
  return `${Array.from(parts[0])[0]}${parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : ""}`.toLocaleUpperCase(
    "de",
  );
}

export function knowledgePersonLabel(person: KnowledgePerson | null): string {
  return person
    ? person.display_name?.trim() || "Ehemaliger Mitarbeiter"
    : "Nicht zugeordnet";
}

export function knowledgePersonForId(
  id: string | null,
  person: KnowledgePerson | null | undefined,
  profiles: readonly {
    user_id: string;
    display_name: string | null;
    avatar_url?: string | null;
  }[] = [],
): KnowledgePerson | null {
  if (!id) return null;
  if (person?.user_id === id) return person;
  const profile = profiles.find((candidate) => candidate.user_id === id);
  return {
    user_id: id,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
  };
}

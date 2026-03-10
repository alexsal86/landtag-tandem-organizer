export function getInitials(name?: string | null): string {
  if (!name) return "?";

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "?";
}

export function fmt(m: number): string {
  const sign = m < 0 ? "-" : "";
  const absM = Math.abs(m);
  return `${sign}${Math.floor(absM / 60)}:${(absM % 60).toString().padStart(2, "0")}`;
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    work: "Arbeit",
    vacation: "Urlaub",
    sick: "Krankheit",
    overtime_reduction: "Überstundenabbau",
  };
  return labels[type] || type;
}

export function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

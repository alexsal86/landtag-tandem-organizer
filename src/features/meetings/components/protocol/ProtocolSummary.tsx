export function ProtocolSummary({
  points,
  decisions,
  openDecisions,
  tasks,
}: {
  points: number;
  decisions: number;
  openDecisions: number;
  tasks: number;
}) {
  return (
    <div
      className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden"
      aria-label="Protokoll-Kennzahlen"
    >
      {[
        { id: "agenda", value: points, label: "Hauptpunkte besprochen" },
        {
          id: "decisions",
          value: decisions,
          label: `Entscheidungen, ${openDecisions} offen`,
        },
        { id: "tasks", value: tasks, label: "Aufgaben erstellt" },
      ].map((tile) => (
        <a
          key={tile.id}
          href={`#protocol-${tile.id}`}
          className="rounded-lg border bg-muted/20 px-3 py-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <b className="block text-2xl leading-tight">{tile.value}</b>
          <span className="text-xs text-muted-foreground">{tile.label}</span>
        </a>
      ))}
    </div>
  );
}

// Reine Regeln für die Folgenabschätzung vor dem Löschen von Konfiguration.
// Die Zählung selbst kommt aus public.config_delete_impact; hier wird nur geparst
// und in Klartext übersetzt, damit Dialog und Selbsttest dieselbe Bewertung nutzen.

export interface ConfigImpactReference {
  key: string;
  /** Singular, z. B. "Dokument" */
  label: string;
  count: number;
}

export interface ConfigImpact {
  known: boolean;
  label: string | null;
  total: number;
  references: ConfigImpactReference[];
}

const DATIVE: Record<string, { one: string; many: string }> = {
  documents: { one: "einem Dokument", many: "Dokumenten" },
  case_files: { one: "einer Fallakte", many: "Fallakten" },
  tasks: { one: "einer Aufgabe", many: "Aufgaben" },
  todos: { one: "einem ToDo", many: "ToDos" },
  appointments: { one: "einem Termin", many: "Terminen" },
};

/** Fehlende oder unlesbare Auskunft ist keine Freigabe: known=false sperrt das Löschen. */
export function parseConfigImpact(raw: unknown): ConfigImpact {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unknownImpact();
  const record = raw as Record<string, unknown>;
  const rawReferences = record.references;
  const rawTotal = record.total;
  if (!Array.isArray(rawReferences)) return unknownImpact();
  if (typeof rawTotal !== "number" || !Number.isFinite(rawTotal) || rawTotal < 0) return unknownImpact();

  const references: ConfigImpactReference[] = [];
  for (const entry of rawReferences) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return unknownImpact();
    const reference = entry as Record<string, unknown>;
    const count = reference.count;
    if (typeof reference.key !== "string" || typeof reference.label !== "string") return unknownImpact();
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return unknownImpact();
    references.push({ key: reference.key, label: reference.label, count });
  }

  return {
    known: true,
    label: typeof record.label === "string" ? record.label : null,
    total: rawTotal,
    references,
  };
}

export function unknownImpact(): ConfigImpact {
  return { known: false, label: null, total: 0, references: [] };
}

function referencePhrase(reference: ConfigImpactReference): string {
  const forms = DATIVE[reference.key];
  if (!forms) return `${reference.count} ${reference.label}`;
  return reference.count === 1 ? forms.one : `${reference.count} ${forms.many}`;
}

export function summarizeConfigImpact(impact: ConfigImpact): string {
  if (!impact.known) return "Auswirkung konnte nicht geprüft werden.";
  if (impact.total === 0 || impact.references.length === 0) return "Keine Verwendung gefunden.";
  const phrases = impact.references.map(referencePhrase);
  const list = phrases.length === 1
    ? phrases[0]
    : `${phrases.slice(0, -1).join(", ")} und ${phrases[phrases.length - 1]}`;
  return `Wird in ${list} verwendet.`;
}

/**
 * Ereignisgruppen des Audit-Trails im Security-Cockpit.
 *
 * Die Aktionen sind bewusst aufgezählt und nicht über ein Präfixmuster
 * erschlossen: Ein Muster wie `security.%` würde „Zugriff verweigert“ mit
 * DSGVO-Ereignissen vermischen. Jede neue Aktion gehört hierher und in den
 * Schreiber, der sie erzeugt (Migration 20261128110000, log-auth-failure,
 * gdpr-process, log-audit-event).
 */
export type SecurityEventGroupId = "gdpr" | "roles" | "auth" | "access";

export interface SecurityEventGroup {
  id: SecurityEventGroupId;
  /** Kurzform für die Filterschaltfläche. */
  label: string;
  /** Ausführliche Bezeichnung für Titel und Hilfetext. */
  title: string;
  actions: readonly string[];
}

export const SECURITY_EVENT_GROUPS: readonly SecurityEventGroup[] = [
  {
    id: "gdpr",
    label: "DSGVO",
    // Genau die Ereignisse, die geschrieben werden: Anlegen und Zurückziehen
    // (Trigger auf gdpr_requests), Freigabe (approve_gdpr_delete) und
    // Ausführung von Löschung oder Export (gdpr-process).
    title: "DSGVO-Anträge: angelegt, zurückgezogen, freigegeben, ausgeführt",
    actions: [
      "security.gdpr.request_created",
      "security.gdpr.request_withdrawn",
      "security.gdpr.delete_approved",
      "security.gdpr.delete_completed",
      "security.gdpr.export_completed",
    ],
  },
  {
    id: "roles",
    label: "Rollen",
    title: "Rollen- und Rechteänderungen",
    actions: ["user.role_assigned", "user.role_changed", "user.role_removed"],
  },
  {
    id: "auth",
    label: "Anmeldung",
    title: "Fehlgeschlagene Anmeldungen",
    actions: ["auth.login_failed", "auth.mfa_failed"],
  },
  {
    id: "access",
    label: "Zugriff",
    title: "Verweigerte Zugriffe",
    actions: ["security.access_denied"],
  },
] as const;

/** Alle Aktionen, die als sicherheitskritisch gelten. */
export const SECURITY_EVENT_ACTIONS: readonly string[] = SECURITY_EVENT_GROUPS.flatMap(
  (group) => group.actions,
);

export type AuditFilter = "all" | "security" | SecurityEventGroupId;

export interface AuditFilterOption {
  id: AuditFilter;
  label: string;
  title: string;
}

export const AUDIT_FILTER_OPTIONS: readonly AuditFilterOption[] = [
  { id: "all", label: "Alle", title: "Alle Ereignisse" },
  { id: "security", label: "Sicherheit", title: "Alle sicherheitskritischen Ereignisse" },
  ...SECURITY_EVENT_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    title: group.title,
  })),
];

/**
 * Aktionen für den gewählten Filter, oder `null` für „kein Filter“.
 * Der Aufrufer filtert damit in der Datenbank, nicht in den bereits geladenen
 * Zeilen: Sonst fände der Filter nur, was zufällig unter den letzten Einträgen
 * liegt, und ein leeres Ergebnis wäre irreführend.
 */
export function auditActionsFor(filter: AuditFilter): string[] | null {
  if (filter === "all") return null;
  if (filter === "security") return [...SECURITY_EVENT_ACTIONS];
  return [...(SECURITY_EVENT_GROUPS.find((group) => group.id === filter)?.actions ?? [])];
}

export function securityGroupForAction(action: string): SecurityEventGroup | null {
  return SECURITY_EVENT_GROUPS.find((group) => group.actions.includes(action)) ?? null;
}

export function isSecurityEventAction(action: string): boolean {
  return securityGroupForAction(action) !== null;
}

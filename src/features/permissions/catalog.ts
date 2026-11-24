/**
 * Gemeinsamer Katalog für Berechtigungs-Editor und Rechte-Explorer.
 * Der Katalog ist die einzige Quelle für Schlüssel und Anzeigetexte; die Datenbank
 * liefert nur Entscheidungen zu diesen Schlüsseln.
 */

export const PERMISSION_ROLES = [
  { value: "abgeordneter", label: "Abgeordneter" },
  { value: "bueroleitung", label: "Büroleitung" },
  { value: "mitarbeiter", label: "Mitarbeiter" },
  { value: "praktikant", label: "Praktikant" },
] as const;

export type PermissionRole = (typeof PERMISSION_ROLES)[number]["value"];

export const FEATURE_KEYS: Array<{ key: string; label: string; description: string }> = [
  { key: "module.events", label: "Veranstaltungen", description: "Eventplanung, RSVP, Checklisten" },
  { key: "module.letters", label: "Briefe", description: "Letter-Designer und Versand" },
  { key: "module.knowledge", label: "Wissen", description: "Dossiers, Wissensbereich" },
  { key: "module.editorial", label: "Redaktion", description: "Themenbacklog, Social-Planner" },
  { key: "module.timetracking", label: "Zeitwirtschaft", description: "Zeiterfassung, Urlaube, Tageszettel" },
  { key: "module.casefiles", label: "Fallakten", description: "Fallakten und Vorgänge" },
  { key: "module.maps", label: "Karten/Wahlkreise", description: "Wahlkreiskarte mit Layern" },
];

export const ACTION_KEYS: Array<{ key: string; label: string }> = [
  { key: "knowledge.write", label: "Wissensfragen stellen und Antworten bearbeiten" },
  { key: "knowledge.manage", label: "Wissensfragen bearbeiten, archivieren und zusammenführen" },
  { key: "knowledge.verify", label: "Wissensantworten prüfen" },
  { key: "letter.send", label: "Brief versenden" },
  { key: "letter.delete", label: "Brief löschen" },
  { key: "decision.archive", label: "Entscheidung archivieren" },
  { key: "case.close", label: "Fallakte schließen" },
  { key: "workflow.execute_manual", label: "Workflow manuell auslösen" },
  { key: "contact.delete", label: "Kontakt löschen" },
  { key: "tenant.invite_user", label: "Mitarbeiter einladen" },
];

export const FIELD_TARGETS: Array<{ table: string; column: string; label: string }> = [
  { table: "contacts", column: "phone", label: "Kontakt · Telefon" },
  { table: "contacts", column: "email", label: "Kontakt · E-Mail" },
  { table: "contacts", column: "notes", label: "Kontakt · Notizen" },
  { table: "contacts", column: "mobile_phone", label: "Kontakt · Mobiltelefon" },
  { table: "contacts", column: "business_phone", label: "Kontakt · Geschäftstelefon" },
  { table: "letters", column: "content", label: "Brief · Inhalt" },
  { table: "letters", column: "content_html", label: "Brief · formatierter Inhalt" },
];

/**
 * Aktionen, die ohne ihr Modul im Arbeitsbereich nicht erreichbar sind.
 * Der Explorer nutzt diese Zuordnung, um Widersprüche zwischen Rollenrecht und
 * Modulschalter sichtbar zu machen. Aktionen ohne Zuordnung bleiben ungeprüft.
 */
export const ACTION_MODULE: Record<string, string | undefined> = {
  "knowledge.write": "module.knowledge",
  "knowledge.manage": "module.knowledge",
  "knowledge.verify": "module.knowledge",
  "letter.send": "module.letters",
  "letter.delete": "module.letters",
  "case.close": "module.casefiles",
};

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_ROLES.map((role) => [role.value, role.label]),
);

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "ohne Rolle";
  return ROLE_LABELS[role] ?? role;
}

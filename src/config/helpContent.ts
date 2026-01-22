export interface HelpContent {
  title: string;
  description: string;
  features: string[];
}

export const MYWORK_HELP_CONTENT: Record<string, HelpContent> = {
  capture: {
    title: "Quick Notes",
    description: "Erfasse schnell Gedanken, Ideen oder Aufgaben.",
    features: [
      "Notizen mit Farben und Prioritäten markieren",
      "Notizen an Jour Fixe-Meetings anhängen",
      "Als Aufgabe speichern für spätere Bearbeitung",
      "Notizen teilen oder archivieren"
    ]
  },
  tasks: {
    title: "Aufgaben",
    description: "Übersicht aller dir zugewiesenen und von dir erstellten Aufgaben.",
    features: [
      "Aufgaben als erledigt markieren (Checkbox)",
      "Unteraufgaben einzeln abhaken",
      "Zur vollständigen Aufgabenliste wechseln (Pfeil-Icon)",
      "Farbige Prioritätsanzeige (rot=hoch, gelb=mittel, grün=niedrig)"
    ]
  },
  decisions: {
    title: "Entscheidungen",
    description: "Abstimmungen, an denen du teilnimmst oder die du erstellt hast.",
    features: [
      "Auf Entscheidungen antworten (Ja/Nein/Frage)",
      "Status deiner erstellten Entscheidungen verfolgen",
      "Neue Entscheidung erstellen",
      "Farbige Anzeige: Grün=Ja, Rot=Nein, Orange=Fragen, Grau=Ausstehend"
    ]
  },
  jourFixe: {
    title: "Jour Fixe",
    description: "Deine regelmäßigen Team-Meetings mit Agenda und Protokoll.",
    features: [
      "Kommende und vergangene Meetings einsehen",
      "Meeting-Details und Agenda öffnen",
      "Notizen für Meetings vorbereiten",
      "Neues Jour Fixe erstellen"
    ]
  },
  casefiles: {
    title: "FallAkten",
    description: "Sammlung von Vorgängen und Fällen, die du bearbeitest.",
    features: [
      "Aktive und wartende Akten im Überblick",
      "Nach Priorität und Zieldatum sortiert",
      "Zur FallAkten-Verwaltung wechseln"
    ]
  },
  plannings: {
    title: "Planungen",
    description: "Event-Planungen, an denen du beteiligt bist.",
    features: [
      "Eigene und geteilte Planungen sehen",
      "Fortschritt der Checklisten verfolgen",
      "Schnellansicht mit wichtigen Details"
    ]
  },
  time: {
    title: "Meine Zeit",
    description: "Erfasse und verwalte deine Arbeitszeiten.",
    features: [
      "Wochenübersicht mit Soll/Ist-Vergleich",
      "Schnelle Zeiterfassung für den aktuellen Tag",
      "Letzte Einträge im Überblick"
    ]
  },
  team: {
    title: "Team",
    description: "Übersicht über dein Team und offene Anliegen.",
    features: [
      "Arbeitszeitstatus der Teammitglieder",
      "Offene Gesprächsanfragen",
      "Warnungen bei fehlenden Zeiteinträgen",
      "Direkter Zugang zu Mitarbeitergesprächen"
    ]
  }
};

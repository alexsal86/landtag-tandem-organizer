export interface HelpContent {
  title: string;
  description: string;
  features: Array<string | { label: string; targetId?: string }>;
}

export const MYWORK_HELP_CONTENT: Record<string, HelpContent> = {
  capture: {
    title: "Quick Notes",
    description: "Erfasse schnell Gedanken, Ideen oder Aufgaben.",
    features: [
      { label: "Direkt links eine neue Notiz erfassen und rechts bestehende Notizen prüfen" },
      { label: "Notizen priorisieren, einfärben und in Aufgaben/Entscheidungen/Vorgänge umwandeln" },
      { label: "Notizen mit Jour Fixe verknüpfen, teilen oder archivieren" },
      { label: "Über den Neu-Button sofort eine neue Aufgabe/Entscheidung/Jour Fixe/Akte anlegen", targetId: "mywork-new-menu" }
    ]
  },
  tasks: {
    title: "Aufgaben",
    description: "Übersicht aller dir zugewiesenen und von dir erstellten Aufgaben.",
    features: [
      { label: "Aufgaben nach Status priorisieren, öffnen und direkt als erledigt markieren" },
      { label: "Unteraufgaben, Kommentare, Wiedervorlage und Anhänge in der Aufgabe pflegen" },
      { label: "Zuständigkeit und Priorität anpassen sowie Entscheidungen aus Aufgaben anstoßen" },
      { label: "Über den Neu-Button eine neue Aufgabe erstellen", targetId: "mywork-new-menu" }
    ]
  },
  decisions: {
    title: "Entscheidungen",
    description: "Abstimmungen, an denen du teilnimmst oder die du erstellt hast.",
    features: [
      { label: "Entscheidungen mit Ja/Nein/Frage beantworten und den Verlauf nachvollziehen" },
      { label: "Offene Rückmeldungen und den Gesamtstatus pro Entscheidung überwachen" },
      { label: "Neue Entscheidungen anlegen und mit Notizen oder Aufgaben verknüpfen", targetId: "mywork-new-menu" },
      { label: "Per Tab-Navigation schnell zwischen Aufgaben, Entscheidungen und Vorgängen wechseln", targetId: "mywork-tab-decisions" }
    ]
  },
  jourFixe: {
    title: "Jour Fixe",
    description: "Deine regelmäßigen Team-Meetings mit Agenda und Protokoll.",
    features: [
      { label: "Kommende und vergangene Jour-Fixe-Termine inkl. Detailansicht verwalten" },
      { label: "Agenda, Protokoll und Vorbereitungsnotizen zentral pflegen" },
      { label: "Aufgaben und Entscheidungen direkt aus dem Meeting-Kontext nachverfolgen" },
      { label: "Neues Jour Fixe über den Neu-Button anlegen", targetId: "mywork-new-menu" }
    ]
  },
  cases: {
    title: "Vorgänge",
    description: "Zentrale Fallbearbeitung mit Anliegen als Arbeitsliste und Akten als Kontext.",
    features: [
      { label: "Anliegen mit Status, Frist und Verantwortlichkeit als Arbeitsliste steuern" },
      { label: "Verknüpfte Akten als Kontext öffnen und Historie nachvollziehen" },
      { label: "Vorgänge und Akten neu anlegen", targetId: "mywork-new-menu" },
      { label: "Zwischen den Bereichen über die Tab-Leiste springen", targetId: "mywork-tab-cases" }
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
      { label: "Arbeitszeiten pro Tag erfassen und Einträge direkt korrigieren" },
      { label: "Soll-/Ist-Stunden in der Wochen- und Monatsansicht prüfen" },
      { label: "Offene oder fehlende Zeiten schnell identifizieren" },
      { label: "Teamstatus prüfen (falls berechtigt)", targetId: "mywork-tab-team" }
    ]
  },
  team: {
    title: "Team",
    description: "Übersicht über dein Team und offene Anliegen.",
    features: [
      { label: "Arbeitszeitstatus und Auslastung im Team auf einen Blick sehen" },
      { label: "Fehlende Zeiteinträge und offene Hinweise frühzeitig erkennen" },
      { label: "Mitarbeitergespräche und Rückmeldungen strukturiert nachhalten" },
      { label: "Realtime-Status prüfen, ob Live-Daten verbunden sind", targetId: "mywork-realtime" }
    ]
  },
  dashboard: {
    title: "Dashboard",
    description: "Dein Überblick über die wichtigsten offenen Punkte in Meine Arbeit.",
    features: [
      { label: "Offene Aufgaben, Entscheidungen und Vorgänge in einer kompakten Übersicht prüfen" },
      { label: "Schnell in den relevanten Arbeitsbereich springen", targetId: "mywork-tab-dashboard" },
      { label: "Direkt neue Einträge über den Neu-Button anlegen", targetId: "mywork-new-menu" }
    ]
  },
  redaktion: {
    title: "Redaktion",
    description: "Arbeite an redaktionellen Inhalten und behalte offene Punkte im Blick.",
    features: [
      { label: "Inhalte sichten, priorisieren und den Bearbeitungsstand verfolgen" },
      { label: "Offene redaktionelle Aufgaben im Tagesgeschäft bündeln" },
      { label: "Über die Tab-Leiste schnell in angrenzende Bereiche wechseln", targetId: "mywork-tab-redaktion" }
    ]
  },
  feedbackfeed: {
    title: "Feedback-Feed",
    description: "Sammelt Rückmeldungen aus Terminen und laufenden Themen zentral an einer Stelle.",
    features: [
      { label: "Neue Rückmeldungen laufend prüfen und priorisiert abarbeiten" },
      { label: "Bei Bedarf direkt Folgeaufgaben oder Vorgänge daraus erstellen", targetId: "mywork-new-menu" },
      { label: "Für Live-Aktualisierung den Realtime-Status beachten", targetId: "mywork-realtime" }
    ]
  }
};

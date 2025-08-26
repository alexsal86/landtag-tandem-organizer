export const FILTER_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "todo", label: "Zu erledigen" },
  { value: "in-progress", label: "In Bearbeitung" },
  { value: "completed", label: "Abgeschlossen" }
];

export const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "Alle Kategorien" },
  { value: "legislation", label: "Gesetzgebung" },
  { value: "constituency", label: "Wahlkreis" },
  { value: "committee", label: "Ausschuss" },
  { value: "personal", label: "Persönlich" },
  { value: "call_followup", label: "Anruf Nachbereitung" },
  { value: "call_follow_up", label: "Anruf Follow-up" }
];

export const PRIORITY_FILTER_OPTIONS = [
  { value: "all", label: "Alle Prioritäten" },
  { value: "high", label: "Hoch" },
  { value: "medium", label: "Mittel" },
  { value: "low", label: "Niedrig" }
];

export const SNOOZE_PRESET_OPTIONS = [
  { label: "1 Stunde", hours: 1 },
  { label: "Heute Abend", hours: 8 },
  { label: "Morgen", hours: 24 },
  { label: "Nächste Woche", hours: 168 },
  { label: "Nächsten Monat", hours: 720 }
];
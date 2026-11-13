# Phase 3: HR-Onboarding und Offboarding

Beschäftigungen erhalten Eintritt/Austritt, Beschäftigungsart und Mentor:in.
Der neue HR-Tab unter `/employee` zeigt Pflicht-/Optionalfortschritt, Phasen und
Nachweise. Der Team-Tab erinnert an Pflichtpunkte und Austritte. Die Administration
bearbeitet die drei Rollenvorlagen und Offboarding mit dem bestehenden
Routinen-Schritte-Editor.

Die Routine-Pakete werden um personenbezogene Starts und feste Eintritts-/
Austrittsanker erweitert; dieselbe Ablaufsteuerung und derselbe 15-Minuten-Job
bleiben zuständig. Starts sind je Beschäftigung und Richtung idempotent.
DSGVO-Nachweise speichern Datum, bestätigende Person und optional ein
Tenant-Dokument; ein normaler Aufgaben-Haken reicht nicht. RLS schützt HR-Daten
und die zugrunde liegenden Aufgaben/Teilaufgaben vor anderen Mitarbeitenden.

Phase 2 entfällt laut aktualisiertem Auftrag. Deshalb enthält diese Phase die
minimale sichere `handover_tasks_to_deputy`-RPC als Offboarding-Abhängigkeit.
Sie erhält den Ball-Typ und überträgt persönliche HR-Aufgaben nicht. Externe
Konten werden über menschliche Checklistenpunkte gesperrt, nicht automatisch.
Kalendertage gelten für Fristen; laufende Snapshots ändern sich bei Änderungen
an Vorlagen oder Beschäftigungsdaten nicht. Der Paketabschluss behält die
bisherige Regel bei und wartet auch auf optionale Schritte.

Gezielt geprüft: sieben neue Vitest-Tests, HR-Strict-/Mitarbeiter-Typecheck und
Feature-Lint. Ein fokussierter PGlite-Smoke prüft die Migration zweimal,
Paketstart/Wiederholung, Nachweissperre, Tenant-/Rollengrenzen, Aufgabenübergabe
und tägliche Erinnerungsansprüche. Keine vollständige Testsuite und keine
Browser-Testserie, wie gewünscht. Live-Migration, echte Supabase-Sitzung und
Benachrichtigungszustellung sind offen. Phase 1 wurde inzwischen zusammengeführt; der separate Phase-3-PR richtet sich
gegen `main`.

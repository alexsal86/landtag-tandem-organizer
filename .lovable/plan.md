# Aufgaben als Stafetten-Workspace

Ziel: Aufgaben in „Meine Arbeit“ bekommen das bewährte Vorgänge-Prinzip (Wer ist am Zug, nächster Schritt, Wiedervorlage), kombiniert mit einer schnellen, kompakten Triage-Liste.

## Was du sehen wirst

**Linke Spalte (Triage-Liste, ca. 340px)**
- **Mein Zug** – nur Aufgaben, bei denen ich selbst handeln muss (heute fällig, überfällig oder ohne Frist).
- **Wartet auf andere** – Aufgaben, die ich übergeben habe (an Abgeordnete/n, Kolleg:in oder extern), mit Hinweis wer gerade dran ist und Entscheidungsstatus (z. B. „Freigabe 1/2“).
- **Wiedervorlage** – einklappbar; Aufgaben mit Schritt-Frist in der Zukunft. Am Stichtag rutschen sie automatisch zurück nach „Mein Zug“.
- Kompakte Zeilen wie bei Vorgängen: Titel, darunter Schritt + Frist, kein Punkt davor.

**Rechte Seite (Detail)**
- Kopf: Titel, Priorität, Kontext-Chips (verknüpfter Vorgang, Jour Fixe, Entscheidung).
- **Wer ist am Zug?** – Ich/Büro, Abgeordnete/r, Extern; plus Verantwortliche Person.
- **Nächster Schritt** mit Frist. Ohne Schritt: Button „Schritt festlegen“. Mit Schritt: „Schritt erledigt“ → Dialog „Aufgabe abschließen“ oder „Folgeschritt festlegen“.
- **Zur Freigabe vorlegen** – ein Klick: Ball geht an die Abgeordnete/den Abgeordneten, Aufgabe wandert bei mir nach „Wartet auf andere“.
- **Schnellaktionen** (wie bei Vorgängen): Auf Tageszettel, Auf Jour Fixe, Entscheidung anfordern.
- **Verlauf**: Eingabefeld für Notizen oben, darunter alle Übergaben, Schritt-Änderungen und Erledigungen automatisch protokolliert.

**Tastatur**: J/K blättern, E Schritt erledigt, T auf Tageszettel, C neue Aufgabe.

Die bisherigen Ansichten (Liste/Board) bleiben über einen Umschalter erreichbar, die neue Ansicht wird Standard.

## Umsetzungsschritte

1. Datenfelder für Aufgaben ergänzen (am Zug, nächster Schritt, Schritt-Frist, Verlauf).
2. Gemeinsame Regeln (Zonen-Zuordnung, Wiedervorlage, Verlaufseinträge) als geprüfte Logik, analog zu Vorgängen.
3. Triage-Liste links mit drei Zonen.
4. Detailbereich mit Am-Zug-Panel, Schritt-Logik, Freigabe-Button, Schnellaktionen und Verlauf.
5. Tastaturkürzel.
6. Selbsttest „Aufgaben-Stafette“: Schritt festlegen → Wiedervorlage → Freigabe vorlegen → Rückgabe → abschließen.

## Technische Details

- Migration auf `tasks`: `ball_owner text` (office/deputy/external, default office), `ball_assignee_id uuid` (profiles.id), `next_action text`, `next_action_due date`, `timeline jsonb default '[]'`. Bestehende RLS/Mandanten-Filter bleiben.
- Neue Pure-Logik `src/features/tasks/stafette.ts` (+ Tests): `taskZone(task, me, today)`, `stepState`, `isOnResubmission`, `stafetteEvents` – Wiederverwendung/Anlehnung an `src/features/cases/items/ball.ts`.
- Neue Komponenten unter `src/components/my-work/tasks/workspace/`: `TaskTriageList`, `TaskDetailView`, `TaskBallPanel`, `TaskQuickActions`, `TaskTimeline`; Einbindung in `MyWorkTasksTab.tsx` mit View-Umschalter.
- Entscheidungsstatus aus `task_decisions` (task_id) in Zeile und Detail anzeigen.
- Tageszettel-Link nutzt `linkedSource {type:"task"}`; Jour Fixe über bestehendes `pending_for_jour_fixe`.
- Selftest-Szenario `task-stafette-lifecycle.ts` mit `kind:"logic"`-Schritten für Zonenregeln.
- Nebenbei: `TasksView` nutzt noch `window.location.href` für `/tasks/new` – wird auf `useNavigate` umgestellt, falls gewünscht.

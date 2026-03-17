

# Plan: Meine Arbeit Tabs Umstrukturierung & Themenspeicher-Integration

## Übersicht

Sieben Aufgabenbereiche, die ich nacheinander adressiere.

---

## 1. Build-Fehler beheben

**Problem:** `SocialMediaPlannerPanel` akzeptiert keine Props, wird aber mit `refreshToken` aufgerufen (Zeile 336 in `MyWorkPlanningsTab.tsx`).

**Fix:** Props-Interface zu `SocialMediaPlannerPanel` hinzufügen und an `MyWorkSocialPlannerBoard` weiterreichen (oder ignorieren, da der Board-Hook ohnehin Realtime nutzt). Einfachste Lösung: `refreshToken` prop akzeptieren aber nicht nutzen, oder aus dem Aufruf entfernen.

---

## 2. Neuer Tab "Redaktion" für Themenspeicher + Social Planner

- Neuen Tab `"redaktion"` in `BASE_TABS` (MyWorkView.tsx) einfügen mit Icon `Lightbulb`
- Neue Komponente `MyWorkRedaktionTab.tsx` erstellen: zeigt `ThemenspeicherPanel` und `SocialMediaPlannerPanel` im 50/50 Grid
- `TabValue` Type um `"redaktion"` erweitern
- Lazy-Import in `MyWorkView.tsx` hinzufügen
- Tab-Rendering-Block ergänzen

## 3. Jour Fixe + Planungs-Karten zusammenlegen

- Tab `"plannings"` aus `BASE_TABS` entfernen
- Tab `"jourFixe"` umbenennen zu "Termine & Planung"
- `MyWorkJourFixeTab` erweitern: Planungs-Karten-Sektion aus `MyWorkPlanningsTab` (ab Zeile 338) als zusätzlichen Abschnitt unterhalb der Jour-Fixe-Liste einbinden
- Alternativ: Neuen Wrapper `MyWorkTerminePlanungTab.tsx` erstellen, der beide Komponenten (`MyWorkJourFixeTab` + Planungs-Karten-Teil) in einem Layout kombiniert
- `ThemenspeicherPanel` und `SocialMediaPlannerPanel` aus `MyWorkPlanningsTab` entfernen (diese wandern in den neuen Redaktion-Tab)

## 4. Themenspeicher/Social Planner — Erstellen-Funktionalität prüfen

**Analyse:** Beide Komponenten haben funktionierenden "Erstellen"-Code:
- `ThemenspeicherPanel`: "Neues Thema" Button → Dialog mit Titel, Beschreibung, Tags → `createBacklogTopic()`
- `MyWorkSocialPlannerBoard`: "Neuen Inhalt entwerfen" Button → Dialog mit Topic-Auswahl → `createDraft()`

**Vermutung:** Das Problem liegt möglicherweise an fehlenden Daten (keine Channels konfiguriert, RLS-Policies). Ich werde die DB-Queries und RLS prüfen und ggf. Error-Handling verbessern, damit Fehlermeldungen sichtbar werden.

## 5. Konzeptbewertung Social Planner & Themenspeicher

Der Themenspeicher sammelt Themen-Ideen, der Social Planner ordnet diese in einen Kanban-Workflow ein. Das Konzept ist solide, hat aber UI-Schwächen:
- Das Board zeigt **alle** Status-Buttons pro Karte (6 Buttons pro Item) — zu viel Noise
- Kein Detail-View/Editor für einzelne Items
- Keine Medien-Vorschau oder Bildupload
- Themenspeicher ist auf 12 Items limitiert (hardcoded `.limit(12)`)

## 6. Rückmeldungen → Themenspeicher

- In der Feedback-Ansicht (AppointmentFeedbackWidget oder FeedbackFeed) einen Button "In Themenspeicher übernehmen" hinzufügen
- Beim Klick: Dialog mit vorausgefülltem Titel (aus Feedback-Text), Tags, und Erstellen eines `topic_backlog` Eintrags
- Optional: Verknüpfung zurück zum Feedback speichern (neues Feld `source_type`/`source_id` in `topic_backlog` oder separates Linking)

## 7. Quick Notes → Themenspeicher verschieben

**UI-Flow:**
- Im Kontext-Menü jeder Quick Note eine Option "In Themenspeicher verschieben" hinzufügen
- Dialog zeigt den Notiz-Inhalt als vorausgefüllten Themen-Titel
- Bei Bestätigung: `topic_backlog`-Eintrag erstellen, Notiz optional archivieren oder mit Badge "Übernommen" markieren
- Rückverknüpfung: `topic_backlog.source_note_id` oder Notiz-Metadaten

## 8. Weitere Ideen

- **Kalenderansicht** im Social Planner (Monats-/Wochenansicht statt reines Kanban)
- **Content-Templates** pro Kanal (Instagram vs. LinkedIn haben unterschiedliche Formate)
- **AI-Textgenerierung** für Social-Media-Entwürfe aus dem Themenspeicher
- **Drag & Drop** von Quick Notes direkt auf den Themenspeicher
- **Automatische Themen-Vorschläge** aus erledigten Aufgaben/Entscheidungen

---

## Technische Schritte (Implementierungs-Reihenfolge)

1. Build-Fix: `SocialMediaPlannerPanel` Props oder Aufruf korrigieren
2. `MyWorkRedaktionTab.tsx` erstellen (Themenspeicher + Social Planner)
3. `MyWorkTerminePlanungTab.tsx` erstellen (Jour Fixe + Planungs-Karten)
4. `MyWorkView.tsx` anpassen: Tabs umbenennen, neuen Tab hinzufügen, alten Planungs-Tab entfernen
5. `tabVisibility.ts` um neuen Tab-Typ erweitern
6. Feedback → Themenspeicher: Button + Dialog in Feedback-Komponenten
7. Quick Notes → Themenspeicher: Menü-Option + Dialog in QuickNotesList
8. Themenspeicher `.limit(12)` entfernen oder Pagination einbauen


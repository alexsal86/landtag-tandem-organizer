# Umsetzungsplan: Dossiers für thematische Wissenssammlung

## Zielbild

Ein **Dossier** ist ein themenzentrierter Sammelraum (nicht fallgetrieben), in dem Informationen über längere Zeit strukturiert gepflegt werden können:

- Hintergrundwissen, Quellen, Positionen
- Stakeholder- und Kontaktbezüge
- Chronologie wichtiger Ereignisse
- verknüpfte Dokumente, Notizen, Aufgaben und Termine

Damit ergänzt ein Dossier die Fallakte, ohne deren bestehende Arbeitsweise zu verändern.

## Abgrenzung Fallakte vs. Dossier

| Kriterium | Fallakte | Dossier |
| --- | --- | --- |
| Fokus | konkreter Vorgang/Fall | Thema/Politikfeld |
| Laufzeit | oft begrenzt | häufig langfristig |
| Statusmodell | operativ (aktiv, wartend, abgeschlossen, archiviert) | wissensorientiert (beobachten, aktiv, ruhend, archiviert) |
| Primäre Frage | „Was ist im Fall passiert?“ | „Was wissen wir zum Thema und wie entwickelt es sich?“ |

## Scope für ein MVP

### In Scope

1. Eigenständige Dossier-Entität mit Basisfeldern:
   - `title`, `summary`, `status`, `priority`, `owner`, `tenant_id`
   - `topic_id` (optional) zur Verbindung mit bestehender Themenverwaltung
2. Detailansicht mit 4 Kernbereichen:
   - **Übersicht** (Kurzlage, Verantwortliche, letzte Aktualisierung)
   - **Wissen/Notizen** (strukturierte Inhalte)
   - **Quellen & Dokumente** (Dateien/Links)
   - **Verknüpfungen** (Kontakte, Aufgaben, Termine, ggf. Fallakten)
3. Liste/Filter:
   - nach Status, Priorität, Thema, Verantwortlichen
4. Rechtekonzept analog zu Fallakten (tenant-basiert, rollenabhängig).

### Out of Scope (für später)

- Automatische KI-Zusammenfassungen
- Volltextsuche über externe Quellen
- versionierte Redaktionsfreigaben

## Datenmodell (Vorschlag)

Neue Tabellen:

1. `dossiers`
   - Stammdaten eines Dossiers
2. `dossier_notes`
   - strukturierte Notizen/Abschnitte
3. `dossier_links`
   - polymorphe Verknüpfungen (`contact`, `task`, `appointment`, `document`, `case_file`)
4. `dossier_timeline_events`
   - manuell gepflegte oder automatisch erzeugte Chronologie-Einträge

Leitprinzip: bestehende Module referenzieren, nicht duplizieren.

## UX-Fluss (MVP)

1. Nutzer:in öffnet Bereich „Dossiers“ (eigener Navigationspunkt).
2. „Neues Dossier“:
   - Titel, Thema, Verantwortliche, Kurzbeschreibung.
3. In der Detailansicht:
   - Wissen aufbauen (Notizen, Kernfragen, offene Punkte).
   - Dokumente/Links hinzufügen.
   - Kontakte und Aufgaben verknüpfen.
4. „Letzte Änderungen“ sichtbar, damit Teamarbeit transparent bleibt.

## Rollout in 4 Phasen

### Phase 1 — Fundament

- Migrationen für `dossiers` + RLS.
- Hooks + Basiskomponenten (Liste, Create/Edit, Detail-Layout).
- Navigation und Berechtigungen.

### Phase 2 — Verknüpfungen

- Dossier-Verknüpfungen zu Kontakten, Aufgaben, Terminen, Dokumenten.
- Timeline-Einträge bei zentralen Aktionen (z. B. neue Quelle hinzugefügt).

### Phase 3 — Arbeitsqualität

- Filter/Sortierung/gespeicherte Ansichten.
- Qualitätsfelder: „offene Fragen“, „Positionen“, „Risiken/Chancen“.
- Erinnerungen für Review-Zyklen.

### Phase 4 — Transfer & Intelligenz

- Transfer aus Fallakte → Dossier (Lernwissen sichern).
- optionale KI-Unterstützung (Zusammenfassung, Themenlücken, Briefing-Export).

## Technische Risiken & Gegenmaßnahmen

1. **Doppelte Datenhaltung**  
   Gegenmaßnahme: Links auf bestehende Objekte statt Kopien.
2. **Unklare Zuständigkeit im Team**  
   Gegenmaßnahme: Pflichtfeld „Owner“ + Review-Intervall.
3. **Feature-Überlappung mit Fallakten/Themenspeicher**  
   Gegenmaßnahme: klare Begriffsdefinition im UI und Hilfetext.

## Messbare Erfolgskriterien

- Anteil Dossiers mit mindestens 1 Verknüpfung (Kontakt/Aufgabe/Dokument) > 70 %.
- Median „Time to Briefing“ sinkt (Zeit für thematisches Briefing).
- Anteil archivierter Fallakten mit Wissens-Transfer ins Dossier steigt.
- Positive Nutzerbewertung zur Auffindbarkeit von Themenwissen.

## Nächste konkrete Schritte (2 Sprints)

### Sprint 1

- Datenmodell + RLS + CRUD API.
- Dossier-Liste + Anlegen/Bearbeiten.
- Basis-Detailansicht mit Übersicht und Notizen.

### Sprint 2

- Verknüpfungen (Dokumente/Kontakte/Aufgaben).
- Timeline-Grundfunktion.
- Filter und Verantwortlichen-Ansicht.

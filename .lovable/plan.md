# Appointment-Preparation: Ausbau-Plan

Umsetzung aller vorgeschlagenen Verbesserungen **ohne** PDF-Export und Briefing-Dashboard.

## A. UIX-Politur

1. **Phasen-Stepper oben** — Horizontaler Progress-Indicator über dem Workspace mit „Nächste Phase"-CTA am Ende jeder Phase. Sidebar bleibt für Direktsprung.
2. **Autosave-Indikator** — Dezenter Status oben rechts: „Speichere…" / „✓ Gespeichert vor 3s".
3. **Keyboard-Shortcuts** — `⌘+→/←` Phase wechseln, `⌘+K` Kontakt verknüpfen, `⌘+P` aktuellen Punkt ins Kontakt-Gedächtnis pinnen, `⌘+S` manuell speichern. Inkl. Hilfe-Overlay (`?`).
4. **Fokus-Modus** — Toggle-Button: Sidebar einklappen, nur aktive Phase + Live-Briefing (60/40).
5. **Drag&Drop für Talking Points** — Reihenfolge per dnd-kit umsortierbar (= Gesprächsreihenfolge), persistiert in `talking_point_items`.

## B. Inhaltliche Funktionen

6. **KI-Vorbereitungsassistent** (Lovable AI Gateway, `google/gemini-3-flash-preview`)
   - Edge Function `generate-preparation-suggestions`
   - Input: Anlass, verknüpfte Partner + deren Memory + letzte Interaktionen, Kontaktdaten
   - Output: Vorschläge für Talking Points, Q&A, sensible Punkte, Hintergrundfakten
   - Button „✨ Vorschläge generieren" pro Phase, einzeln übernehmbar
7. **Vorlagen-Bibliothek** — Neue Tabelle `preparation_templates` (Name, Anlasstyp, vorbefüllte Phasen-Daten als JSONB). Beim Anlegen einer Vorbereitung wählbar; Admin-UI zum Pflegen unter Settings.
8. **Verknüpfung zu Vorgängen/Entscheidungen** — In Phase „Fakten" automatisch offene Vorgänge/Entscheidungen der verknüpften Kontakte einblenden (Read-Only Card mit Link).
9. **Wissensdossier-Einbindung** — In Phase „Themen" Dossiers per Tag-/Kontakt-Match vorschlagen, „Quick-Read"-Drawer zum Lesen ohne Verlassen der Vorbereitung.

## C. Geschlossener Kreislauf nach dem Gespräch

10. **Debrief-Phase** (5. Phase „Nachbereitung")
    - Felder: Was wurde besprochen? Ergebnisse? Stimmung? Offene Punkte?
    - Beim Speichern: automatisch Interaktion am verknüpften Kontakt anlegen + neue Memory-Items vorschlagen
11. **Auto-Aufgaben aus Debrief** — Aus „Offene Punkte" mit einem Klick Tasks erzeugen (zugewiesen an Verantwortliche, mit Termin-Referenz).
12. **Erfolgs-Check (Reminder)** — Optional: in 4 Wochen Follow-up-Aufgabe „Hat XY geliefert?" automatisch terminieren.

## D. Übersicht & Discovery (Team-Sharing)

13. **Team-Sharing der Vorbereitung** — Spalte `shared_with` (uuid[]) auf `appointment_preparations`; RLS so erweitern, dass Geteilte lesen/kommentieren dürfen. UI: „Teilen"-Button mit User-Picker im Workspace-Header.

## Datenbank-Änderungen

```text
+ Tabelle preparation_templates (name, anlasstyp, phases_data jsonb, tenant_id)
+ Tabelle preparation_debriefs (preparation_id, content jsonb, mood, outcomes)
+ Spalte appointment_preparations.shared_with uuid[]
+ Edge Function: generate-preparation-suggestions (Lovable AI)
+ RLS-Update appointment_preparations für shared_with
```

## Reihenfolge

**Phase 1 – Foundation:** A1 Stepper, A2 Autosave-Indikator, A4 Fokus-Modus, A5 Drag&Drop  
**Phase 2 – Loop schließen:** C10 Debrief-Phase, C11 Auto-Aufgaben, C12 Erfolgs-Check  
**Phase 3 – Intelligenz:** B6 KI-Assistent, B8 Vorgänge/Entscheidungen, B9 Dossiers  
**Phase 4 – Skalierung:** B7 Vorlagen, D13 Team-Sharing, A3 Shortcuts (zuletzt, weil sie alles oben Genannte abdecken müssen)

## Out of Scope (auf Wunsch ausgeschlossen)

- PDF/Letter-Export der Vorbereitung
- Briefing-Dashboard (heutige/nächste 7 Tage Übersicht)

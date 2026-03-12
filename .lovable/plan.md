

# Vorgang-Erstellungsdialog als Wizard umbauen

## Übersicht
Der aktuelle `CaseItemCreateDialog` zeigt alle Felder in einem langen Formular. Er wird in einen mehrstufigen Wizard mit klarer Schritt-für-Schritt-Führung umgebaut.

## Wizard-Schritte

**Schritt 1 – Kanal & Kontakt**
- Kanal-Auswahl (E-Mail, Telefon, Social Media, Persönlich, Sonstiges)
- Kontaktsuche mit Name, E-Mail, Telefon
- Öffentlich-Toggle

**Schritt 2 – Inhalt**
- Betreff (Pflichtfeld)
- Beschreibung

**Schritt 3 – Einordnung & Zuweisung**
- Kategorie (Pflichtfeld)
- Priorität
- Bearbeiter (Mehrfachauswahl)

**Schritt 4 – Termine & Übersicht**
- Eingangsdatum & Frist
- Zusammenfassung aller Eingaben als Überblick vor dem Absenden

## Technische Umsetzung

- **Datei**: `src/components/my-work/CaseItemCreateDialog.tsx` wird umgebaut
- Neuer State `step` (1–4) steuert die Anzeige
- Fortschrittsbalken oben im Dialog mit den 4 Schritten (aktiver Schritt hervorgehoben)
- "Weiter"/"Zurück"-Buttons ersetzen den einzelnen Submit-Button
- Validierung pro Schritt: Schritt 1 hat keine Pflichtfelder, Schritt 2 erfordert Betreff, Schritt 3 erfordert Kategorie
- Im letzten Schritt erscheint "Vorgang erstellen" statt "Weiter"
- Die bestehende Logik (Kontaktsuche, Submit, Reset) bleibt unverändert
- Stepper-Komponente wird inline im Dialog gebaut (kein separates File nötig)
- Props-Interface bleibt identisch → keine Änderungen an `MyWorkCasesWorkspace.tsx`

## UI-Design
- Stepper-Leiste oben: 4 nummerierte Kreise mit Labels, verbunden durch Linien
- Aktiver Schritt: `bg-primary text-white`, erledigte Schritte: `bg-primary/20`, ausstehend: `bg-muted`
- Zusammenfassung in Schritt 4: kompakte Card-Darstellung aller eingegebenen Werte
- Dialog-Breite bleibt gleich, Höhe wird pro Schritt geringer → angenehmere UX


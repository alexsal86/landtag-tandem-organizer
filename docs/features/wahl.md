# Wahlanalyse & Wahlhistorie

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Wahlergebnisse auswerten, historische Mandate und Landeslisten lesen und die Wahlkreiskarte darstellen.

## Seiten

- `/karten`
- `/daten`

## Rollen

Keine besondere Rolle deklariert; es gilt die aktive Büro-Mitgliedschaft.

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| — | — |

## Prüfumfang

### `election-analysis` — Wahlanalyse: Datenqualität und Vergleichbarkeit

- **Prüfungen:**
  - Unbekannt gegenüber echter Null
  - Getrennte Stimmenarten und gemeinsame Beteiligung
  - Keine erfundenen historischen Identitäten
  - AfD vor Parteigründung
- **Grenzen:**
  - Amtliche Downloads, Datenbank-RLS und Vollständigkeit historischer Kandidaturen sind separate Prüfungen.

### `election-history-workbench` — Wahldaten: Problemfälle und Landeslisten

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Die Schreibberechtigungen, Listenplatz-Constraints und Trigger müssen zusätzlich mit Datenbank-Rollenszenarien geprüft werden.

### `election-deputy-reader` — Wahlanalyse: Abgeordnetenübersicht

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Prüft die erste verfügbare Mandatshistorie. Weitere Rollen und die visuelle Darstellung werden dadurch nicht vollständig abgedeckt.

### `election-map` — Wahlkreiskarte: Suche und Grenzdaten

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Die visuelle Ebenenreihenfolge und mobile Bedienung werden separat im Browser geprüft.

## Detaildoku

- [wahlanalyse.md](../wahlanalyse.md)
- [wahlkreiskarte.md](../wahlkreiskarte.md)
- `docs/election-analysis`

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).

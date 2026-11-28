# Funktionskatalog

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

Der Katalog ist das führende Verzeichnis des tatsächlich implementierten Funktionsumfangs. Er beschreibt keine Soll-Anforderungen. Quellcode liefert die Nachweise, Selbsttests den Prüfumfang, das Security-Cockpit Sicherheitsbefunde – ohne dass daraus automatisch ein bestandener Test wird.

## Kennzahlen

| Kennzahl | Wert |
|---|---:|
| Erfasste Funktionen | 278 |
| Funktionsbereiche | 16 |
| Unterbereiche | 114 |
| Implementiert | 274 |
| Teilweise implementiert | 2 |
| Deaktiviert | 0 |
| Potenziell verwaist | 0 |
| Prüfkandidaten (offene Punkte) | 52 |
| Funktionen mit Selbsttest | 148 |
| Funktionen mit Unit-Test | 68 |
| Funktionen mit Integrationstest | 7 |
| Funktionen mit Browser-Test | 4 |
| Funktionen mit Security-Test | 1 |
| Funktionen ohne zugeordneten Test | 86 |
| Funktionen ohne Dokumentationsverweis | 178 |
| Funktionen mit bekannten Einschränkungen | 100 |
| Nicht nachweisbar eingebundene Funktionen | 1 |
| Technische Zuordnungen | 1406 |

## Funktionsbereiche

| Bereich | Unterbereiche | Funktionen | implementiert | ohne Test | ohne Doku |
|---|---:|---:|---:|---:|---:|
| [Administration, Sicherheit & Qualität](./verwaltung.md) | 12 | 25 | 25 | 10 | 10 |
| [Aufgaben & Stafette](./aufgaben.md) | 12 | 18 | 18 | 1 | 9 |
| [Automatisierung & Workflows](./automation.md) | 8 | 15 | 15 | 9 | 8 |
| [Dokumente, Briefe & Annotationen](./dokumente.md) | 3 | 18 | 18 | 2 | 14 |
| [Entscheidungen](./entscheidungen.md) | 9 | 20 | 20 | 3 | 9 |
| [Externe Schnittstellen](./schnittstellen.md) | 7 | 10 | 10 | 7 | 5 |
| [Jour fixe, Dossiers & Themen](./organisation.md) | 5 | 19 | 18 | 10 | 16 |
| [Kontakte & Netzwerk](./kontakte.md) | 10 | 16 | 16 | 0 | 12 |
| [Meine Arbeit & Benachrichtigungen](./arbeitsbereich.md) | 8 | 17 | 16 | 5 | 12 |
| [Mitarbeit, Personal & Zeit](./mitarbeit.md) | 5 | 20 | 20 | 3 | 14 |
| [Redaktion, News & Chat](./kommunikation.md) | 5 | 14 | 14 | 11 | 10 |
| [Termine, Anfragen & Briefings](./termine.md) | 8 | 17 | 17 | 4 | 11 |
| [Veranstaltungen & Umfragen](./veranstaltungen.md) | 3 | 9 | 8 | 2 | 6 |
| [Vorgänge & Fallakten](./vorgaenge.md) | 7 | 21 | 20 | 2 | 16 |
| [Wahlanalyse & Wahlhistorie](./wahl.md) | 4 | 23 | 23 | 12 | 15 |
| [Wissensbereich](./wissen.md) | 8 | 16 | 16 | 5 | 11 |

## Kategorien

| Kategorie | Funktionen |
|---|---:|
| fachlich | 185 |
| administrativ | 26 |
| automatisiert | 21 |
| integration | 27 |
| sicherheit | 15 |
| technisch | 4 |

## Implementierungsstatus

| Status | Funktionen |
|---|---:|
| implementiert | 274 |
| teilweise | 2 |
| deaktiviert | 0 |
| verwaist | 0 |
| veraltet | 2 |
| entfernt | 0 |
| unklar | 0 |

## Einbindungsstatus

| Einbindung | Funktionen |
|---|---:|
| UI | 138 |
| systemseitig | 37 |
| rollenabhängig | 98 |
| Feature Flag | 1 |
| ohne Einbindung | 1 |
| ungeprüft | 0 |
| nicht anwendbar | 3 |

## Testabdeckung

| Abdeckung | Funktionen |
|---|---:|
| Selbsttest | 129 |
| Unit-Test | 40 |
| Integrationstest | 5 |
| Browser-Test | 0 |
| Security-Test | 1 |
| teilweise | 17 |
| kein Test | 86 |
| ungeprüft | 0 |

## Konsistenz

Der Generator inventarisiert Routen, Edge Functions, wirksame Datenbankfunktionen, Tabellen, Testszenarien und Testdateien. Aktuell **3** nicht zugeordnete Prüfkandidaten und **3** Review-Hinweise. Eindeutige Inkonsistenzen brechen `npm run check:feature-catalog` ab; Details: [Prüfbericht](./review.md).

## Dokumentation

- [Funktions- und Testabdeckungsmatrix](./matrix.md)
- [Rollen- und Berechtigungszuordnungen](./roles.md)
- [Modulübergreifende Abhängigkeiten](./dependencies.md)
- [Ungeprüfte Funktionen und Prüfkandidaten](./review.md)
- [Entitätskarte](../entity-map.md)

## Pflege

1. Funktion in `src/features/feature-catalog/inventory/<bereich>.json` erfassen oder aktualisieren.
2. Mindestens einen Quellcode-Nachweis in `evidence` hinterlegen.
3. Testzuordnung und Abdeckungsstatus ehrlich setzen; fehlende Tests bleiben sichtbar.
4. `npm run update:feature-catalog` und `npm run check:feature-catalog` ausführen.

Verbindlich: Abschnitt „Funktionskatalog" in [AGENTS.md](../../AGENTS.md).

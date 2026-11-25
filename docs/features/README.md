# Funktionskatalog

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

Der Katalog ist das führende Verzeichnis des tatsächlich implementierten Funktionsumfangs. Er beschreibt keine Soll-Anforderungen. Quellcode liefert die Nachweise, Selbsttests den Prüfumfang, das Security-Cockpit Sicherheitsbefunde – ohne dass daraus automatisch ein bestandener Test wird.

## Kennzahlen

| Kennzahl | Wert |
|---|---:|
| Erfasste Funktionen | 252 |
| Funktionsbereiche | 16 |
| Unterbereiche | 108 |
| Implementiert | 248 |
| Teilweise implementiert | 2 |
| Deaktiviert | 0 |
| Potenziell verwaist | 0 |
| Prüfkandidaten (offene Punkte) | 49 |
| Funktionen mit Selbsttest | 65 |
| Funktionen mit Unit-Test | 53 |
| Funktionen mit Integrationstest | 1 |
| Funktionen mit Browser-Test | 4 |
| Funktionen mit Security-Test | 1 |
| Funktionen ohne zugeordneten Test | 151 |
| Funktionen ohne Dokumentationsverweis | 162 |
| Funktionen mit bekannten Einschränkungen | 22 |
| Nicht nachweisbar eingebundene Funktionen | 1 |
| Technische Zuordnungen | 1201 |

## Funktionsbereiche

| Bereich | Unterbereiche | Funktionen | implementiert | ohne Test | ohne Doku |
|---|---:|---:|---:|---:|---:|
| [Administration, Sicherheit & Qualität](./verwaltung.md) | 11 | 23 | 23 | 15 | 9 |
| [Aufgaben & Stafette](./aufgaben.md) | 12 | 18 | 18 | 7 | 9 |
| [Automatisierung & Workflows](./automation.md) | 8 | 15 | 15 | 9 | 8 |
| [Dokumente, Briefe & Annotationen](./dokumente.md) | 3 | 17 | 17 | 10 | 13 |
| [Entscheidungen](./entscheidungen.md) | 7 | 10 | 10 | 7 | 8 |
| [Externe Schnittstellen](./schnittstellen.md) | 7 | 10 | 10 | 8 | 5 |
| [Jour fixe, Dossiers & Themen](./organisation.md) | 5 | 18 | 17 | 13 | 15 |
| [Kontakte & Netzwerk](./kontakte.md) | 9 | 14 | 14 | 11 | 10 |
| [Meine Arbeit & Benachrichtigungen](./arbeitsbereich.md) | 7 | 13 | 12 | 8 | 8 |
| [Mitarbeit, Personal & Zeit](./mitarbeit.md) | 5 | 20 | 20 | 10 | 14 |
| [Redaktion, News & Chat](./kommunikation.md) | 5 | 14 | 14 | 14 | 10 |
| [Termine, Anfragen & Briefings](./termine.md) | 8 | 17 | 17 | 8 | 11 |
| [Veranstaltungen & Umfragen](./veranstaltungen.md) | 3 | 9 | 8 | 3 | 6 |
| [Vorgänge & Fallakten](./vorgaenge.md) | 6 | 16 | 15 | 8 | 11 |
| [Wahlanalyse & Wahlhistorie](./wahl.md) | 4 | 23 | 23 | 13 | 15 |
| [Wissensbereich](./wissen.md) | 8 | 15 | 15 | 7 | 10 |

## Kategorien

| Kategorie | Funktionen |
|---|---:|
| fachlich | 163 |
| administrativ | 25 |
| automatisiert | 20 |
| integration | 27 |
| sicherheit | 15 |
| technisch | 2 |

## Implementierungsstatus

| Status | Funktionen |
|---|---:|
| implementiert | 248 |
| teilweise | 2 |
| deaktiviert | 0 |
| verwaist | 0 |
| veraltet | 2 |
| entfernt | 0 |
| unklar | 0 |

## Einbindungsstatus

| Einbindung | Funktionen |
|---|---:|
| UI | 124 |
| systemseitig | 36 |
| rollenabhängig | 87 |
| Feature Flag | 1 |
| ohne Einbindung | 1 |
| ungeprüft | 0 |
| nicht anwendbar | 3 |

## Testabdeckung

| Abdeckung | Funktionen |
|---|---:|
| Selbsttest | 64 |
| Unit-Test | 35 |
| Integrationstest | 1 |
| Browser-Test | 0 |
| Security-Test | 1 |
| teilweise | 0 |
| kein Test | 151 |
| ungeprüft | 0 |

## Konsistenz

Der Generator inventarisiert Routen, Edge Functions, wirksame Datenbankfunktionen, Tabellen, Testszenarien und Testdateien. Aktuell **0** nicht zugeordnete Prüfkandidaten und **0** Review-Hinweise. Eindeutige Inkonsistenzen brechen `npm run check:feature-catalog` ab; Details: [Prüfbericht](./review.md).

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

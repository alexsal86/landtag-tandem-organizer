# Funktionsinventarisierung – Abschlussbericht

**Datum:** 25.11.2026
**Gegenstand:** Vollständige Inventarisierung des tatsächlich implementierten Funktionsumfangs und Ausbau des Funktionskatalogs zu einem versionierten, kontinuierlich gepflegten Verzeichnis.
**Maßstab:** Quellcode, Migrationen, generierte Supabase-Typen und registrierte Selbsttests. Keine Soll-Spezifikation, keine erfundenen Funktionen.

---

## 1. Ergebnis in Kürze

| Kennzahl | Wert |
|---|---:|
| Identifizierte und katalogisierte fachliche Funktionen | **252** |
| Davon neu katalogisiert (Vorgängerkatalog hatte keine Funktions-IDs) | **252** |
| Funktionsbereiche | **16** |
| Unterbereiche | **108** |
| Technische Zuordnungen (Referenzen über alle Funktionen) | **1.199** |
| Implementiert | 248 |
| Teilweise implementiert | 2 |
| Deaktiviert | 0 |
| Veraltet (bewusst erhalten, mit Begründung) | 2 |
| Verwaist / unklar | 0 |
| Funktionen mit offenen Prüfpunkten oder Einschränkungen | 49 |
| Funktionen mit mindestens einem Selbsttest-Szenario | 65 |
| Szenario-Referenzen insgesamt / davon verschiedene Szenarien | 69 / 30 |
| Funktionen mit Unit-Test | 53 |
| Funktionen mit Integrationstest | 1 |
| Funktionen mit Browser-Test | 4 |
| Funktionen mit Security-Test | 1 |
| Funktionen ohne zugeordneten Test | **151** |
| Funktionen ohne Dokumentationsverweis | **162** |
| Funktionen mit bekannten Einschränkungen | 22 |
| Nicht nachweisbar in die Oberfläche eingebunden | 1 |
| Nicht zugeordnete Prüfkandidaten (offen) | **0** |
| Versionierte Ausnahmen | 1 |

**Automatisch inventarisiert:** 39 Routen, 74 Edge Functions, 538 wirksame Datenbankfunktionen (nach Drop-Auflösung), 344 Tabellen, 7 Views, 30 registrierte Selbsttest-Szenarien, 318 verschiedene referenzierte Tabellen, 468 referenzierte RPCs, 8 Rollen.

Die Zahlen stammen ausschließlich aus dem Kataloglauf (`npm run report:feature-coverage`, `npm run audit:feature-catalog`) und sind nicht manuell gepflegt.

---

## 2. Architektur der Erweiterung

Der bestehende Katalog wurde erweitert, nicht ersetzt:

- **Zentrale Datenquelle:** `src/features/feature-catalog/inventory/*.json` – 16 Dateien, eine je Funktionsbereich. Jede Funktion besitzt eine stabile ID, Unterbereich, Kategorie, Implementierungs-, Einbindungs- und Teststatus, Nachweise, Routen, Komponenten, Hooks, Services, Edge Functions, RPCs, Tabellen, Rollen, Abhängigkeiten, Tests, Dokumentation, Einschränkungen und Prüfpunkte.
- **Typisierung und Auflösung:** `types.ts` (Enums, Rollen, `FeatureDefinition`), `inventory.ts` (JSON-Loader, Bereichszuordnung, `ResolvedFeature`), `metrics.ts` (Kennzahlen, Filter, Suche, Strukturvalidierung).
- **Generator:** `scripts/build-feature-catalog.mjs` inventarisiert per TypeScript-AST und erzeugt Validierung, Berichte und Dokumentation. Die wirksame Datenbankstruktur wird aus den generierten Supabase-Typen und den nicht gedroppten Migrationen in Dateireihenfolge ermittelt; historische, ersetzte Migrationen werden nicht als aktive Funktion gezählt.
- **Ausnahmen:** `src/features/feature-catalog/exceptions.json` – versioniert, mit `kind`, `key`, `reason`. Aktuell eine Ausnahme (`src/pages/NotFound.tsx`, technische Fallback-Seite ohne eigenständigen Fachumfang).
- **Oberfläche:** `FeatureCatalogView.tsx` mit Kennzahlen, hierarchischer Bereichs-/Unterbereichsnavigation, Volltextsuche, Filtern (Kategorie, Implementierung, Einbindung, Abdeckung, Dokumentation), Detailansicht und den generierten Markdown-Seiten. Die bestehende Entitätskarte bleibt erhalten.
- **Security-Cockpit:** bleibt eigenständig; es verlinkt nun auf den Funktionskatalog. Sicherheitsbefunde (RLS-Coverage, Audit, Snapshots) und fachliche Testergebnisse werden getrennt ausgewiesen.
- **Dokumentation:** `docs/features/` wird vollständig generiert (Übersicht, 16 Bereichsseiten, Matrix, Rollen, Abhängigkeiten, Prüfbericht). Die Dateien tragen den Hinweis „nicht von Hand bearbeiten“.

---

## 3. Statusmodell und Trennung der Aussagen

Implementierungsstatus, Einbindungsstatus, Testabdeckung und Testergebnis sind getrennte Felder. Eine vorhandene Testdatei, ein registriertes Szenario oder eine vorhandene Komponente wird nicht als bestandener Test bzw. funktionierende Oberfläche gewertet. Wo ein Ergebnis nicht vorliegt, steht `unbekannt`, `nicht-ausgefuehrt` oder `ungeprueft`. Many-to-many zwischen Funktionen und Szenarien ist umgesetzt (69 Referenzen auf 30 Szenarien).

**Bewusst nicht als „verwaist“ eingestuft:** zwei veraltete Legacy-Funktionen (`events.legacy-rsvp`, `cases.legacy-routes`) sind als `veraltet` mit Begründung erhalten und werden im Prüfbericht separat gelistet. `mobile.app` ist `teilweise` und als „Einbindung ungeprüft“ markiert.

---

## 4. Geprüfte Quellcodebereiche

Vollständig oder gezielt ausgewertet:

- `src/pages/**`, `src/App.tsx`, `src/pages/Index.tsx` (Routen und Bereichs-Rendering)
- `src/components/**` (Fachkomponenten, Administration inkl. Security-Cockpit, UI-Konventionen)
- `src/features/**` (Fachmodule, Hooks, Services, Selftest-Registry und Szenarien)
- `src/hooks/**`, `src/lib/**`, `src/utils/**`, `src/integrations/**`
- `supabase/functions/**` (74 Edge Functions), `supabase/migrations/**`, `src/integrations/supabase/types.ts`
- `scripts/**` (Katalog-, Coverage- und Selftest-Prüfungen), `e2e/**`
- `.github/workflows/**`, `package.json`, `AGENTS.md`
- `docs/**` (Selftest-Center, Coverage, Security-Matrix, CI-Gates, Entitätskarte, Rollenmatrix)

**Bewusst ausgeschlossen:** `node_modules`, Build-Artefakte (`dist`), generierte Berichte, Assets und UI-Primitive ohne Fachlogik (`src/components/ui/**`). Diese werden keinem eigenen Katalogeintrag zugeordnet; verwendende Fachfunktionen referenzieren sie bei Bedarf.

---

## 5. Automatisierte Erkennung und CI

Der Generator meldet als **Fehler** (CI-Abbruch): doppelte IDs, unbekannte Enum-/Pflichtfelder, fehlende referenzierte Dateien, unbekannte Tabellen/RPCs/Edge Functions/Szenarien, ungültige Abhängigkeiten, Abdeckungswidersprüche, nicht zugeordnete Routen und Edge Functions ohne Ausnahme, veraltete generierte Katalogdateien sowie Doku-Verweise, die nicht generiert werden.

Als **Review-Hinweis** (kein Abbruch): heuristische Kandidaten, insbesondere technische Datenbankfunktionen ohne eindeutige Fachzuordnung, nicht referenzierte Seitenmodule und nicht zugeordnete Szenarien. Es findet keine automatische Löschung statt.

Stand: **0 Fehler, 0 Warnungen, 0 offene Prüfkandidaten, 1 begründete Ausnahme.**

Neu verdrahtet:

- `package.json`: `audit:feature-catalog`, `report:feature-coverage`, `test:feature-catalog` (ergänzend zu vorhandenem `check:`/`update:feature-catalog`).
- `.github/workflows/selftests.yml`: Audit, Report und Katalogtests.
- `.github/workflows/github_workflows_ci_Version3.yml` (`node-quality-gates`): Check, Audit, Report.
- `AGENTS.md`: verbindlicher Abschnitt „Funktionskatalog“ mit Inventarisierungspflicht, ID-Stabilität und Definition of Done für Menschen und KI-Agenten.
- `docs/ci-quality-gates.md`: dokumentiertes Funktionskatalog-Gate.

---

## 6. Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm run check:feature-catalog` | **bestanden** – 0 Fehler, 0 Warnungen, 0 offene Kandidaten |
| `npm run audit:feature-catalog` | bestanden – Zahlen siehe oben |
| `npm run report:feature-coverage` | bestanden – Kennzahlen siehe oben |
| `npm run update:feature-catalog` | ausgeführt – 21 generierte Dateien, keine veralteten Reste |
| `npm run test:feature-catalog` (Node-Tests) | **10/10 bestanden** |
| `npm run test:feature-catalog` (Vitest `src/features/feature-catalog`) | **25/25 bestanden** (4 Dateien, inkl. Rendering der generierten Seiten, Entitätskarte, Deep-Link und RLS-Verknüpfung) |
| `npm run check:selftest-coverage` | bestanden – `missing: 0` (344 Einträge: 57 Szenario, 129 zurückgestellt, 158 ausgeschlossen) |
| `npx tsc -p tsconfig.app.json --noEmit --types node` | **0 Fehler** |
| `npm run build` | **bestanden** (Vite, 6,25 s; nur bestehende Chunk-/Dynamic-Import-Hinweise) |
| ESLint auf geänderten Katalogdateien | 0 Fehler |

**Einschränkungen der Prüfung:**

- Der unveränderte Aufruf `npx tsc -p tsconfig.app.json --noEmit` scheitert an `TS2688: Cannot find type definition file for 'react-grid-layout'`, weil `@types/react-grid-layout@2.1.0` ein veraltetes Stub-Paket ohne Typdatei ist. Das ist ein vorbestehendes Umgebungs-/Paketproblem und betrifft keinen der geänderten Fachpfade; mit `--types node` läuft der Typecheck vollständig durch.
- ESLint meldet in `SecurityCockpit.tsx` zwei vorbestehende ungenutzte Importe (`LoadingState`, `useToast`); sie wurden nicht im Rahmen dieses Auftrags verändert.
- Kein Browser-/E2E-Lauf und keine Live-Datenbankprüfung: Die Oberfläche wurde über Komponententests, nicht durch Klicken im Browser geprüft. RLS-Policies wurden nicht gegen eine laufende Datenbank getestet.
- Die 468 referenzierten RPCs wurden über Signatur, Tabellenbezug und Funktionszuordnung inventarisiert, nicht jede RPC semantisch im Detail nachvollzogen.
- Die mobile Oberfläche (`src/pages/mobile.tsx`) ist nur in ihren nachgewiesenen Teilfunktionen erfasst; ein vollständiger Abgleich mit der Desktop-Variante steht aus.
- Historische Migrationen wurden statisch (Dateireihenfolge, Drop-Erkennung) ausgewertet, nicht gegen eine Produktivdatenbank verifiziert.

---

## 7. Geänderte Dateien

**Katalog und Oberfläche**

- `src/features/feature-catalog/types.ts` (neu)
- `src/features/feature-catalog/inventory.ts` (neu)
- `src/features/feature-catalog/inventory/*.json` (16 neue Bereichsdateien)
- `src/features/feature-catalog/metrics.ts` (neu)
- `src/features/feature-catalog/metrics.test.ts` (neu)
- `src/features/feature-catalog/exceptions.json` (neu)
- `src/features/feature-catalog/FeatureCatalogView.tsx` (ersetzt)
- `src/features/feature-catalog/MarkdownView.test.tsx` (an die neue generierte Struktur angepasst)
- `src/components/administration/SecurityCockpit.tsx` (Link zum Funktionskatalog)

**Generator, Tests, Regeln, CI**

- `scripts/build-feature-catalog.mjs` (ersetzt)
- `scripts/__tests__/feature-catalog.test.mjs` (neu)
- `package.json`
- `AGENTS.md`
- `.github/workflows/selftests.yml`
- `.github/workflows/github_workflows_ci_Version3.yml`
- `docs/ci-quality-gates.md`

**Generierte Dokumentation (`docs/features/`, 21 Dateien)**

- `README.md`, `matrix.md`, `roles.md`, `dependencies.md`, `review.md`
- `arbeitsbereich.md`, `aufgaben.md`, `automation.md`, `dokumente.md`, `entscheidungen.md`, `kommunikation.md`, `kontakte.md`, `mitarbeit.md`, `organisation.md`, `schnittstellen.md`, `termine.md`, `veranstaltungen.md`, `verwaltung.md`, `vorgaenge.md`, `wahl.md`, `wissen.md`

`docs/entity-map.md` bleibt unverändert und wird weiterhin in der Oberfläche angezeigt.

---

## 8. Offene fachliche und technische Fragen

1. **Dokumentationslücken:** 162 Funktionen haben keinen Dokumentationsverweis. Zu entscheiden ist, welche davon eine fachliche Doku erhalten und welche bewusst nur über Code und Katalog erschlossen bleiben.
2. **Testlücken:** 151 Funktionen haben keine Testzuordnung, darunter zentrale administrative und kommunikative Funktionen. Priorisierung und Szenario-Erweiterung sind fachlich zu entscheiden.
3. **Mobile Variante:** Der Abgleich der mobilen Oberfläche mit den Desktop-Funktionen ist unvollständig; `mobile.app` bleibt „teilweise / Einbindung ungeprüft“.
4. **RPC-Tiefe:** Die technische Inventarisierung ist vollständig, die semantische Bewertung der 468 referenzierten Datenbankfunktionen (Fachzweck, Fehlerfälle, Berechtigungsannahmen) ist es nicht.
5. **Sicherheitszuordnung:** RLS-Policies und Sicherheitsbefunde werden im Security-Cockpit geführt, nicht je Funktion dupliziert. Eine feinere Verknüpfung von Findings zu Funktions-IDs wäre ein eigener Schritt.
6. **Ausnahmen:** Die NotFound-Ausnahme ist bewusst eng gefasst. Weitere Ausnahmen sollen nur mit nachvollziehbarer Begründung ergänzt werden.

---

## 9. Ehrliche Abdeckungsaussage

Die Inventarisierung deckt alle 16 fachlichen Bereiche und die automatisch auffindbaren technischen Objekte (Routen, Edge Functions, wirksame Datenbankfunktionen, Tabellen, Szenarien) ab. Sie behauptet **keine** vollständige semantische Erfassung jeder Datenbankfunktion, jeder RLS-Policy und jeder mobilen Interaktion. Funktionen ohne Tests oder ohne Dokumentation sind sichtbar und werden nicht durch die Katalogisierung als geprüft ausgegeben.

---

## 10. Nachtrag: Verknüpfung mit Sicherheitsbefunden (25.11.2026)

Die Sicherheitssicht wurde nach dem Audit feiner mit den Funktions-IDs verknüpft:

- **Neue, rein lesende Datenbankfunktion** `audit_rls_policies(_tables text[])` liefert je Tabelle die wirksamen Policies (Name, Kommando, Rollen, `USING`/`WITH CHECK`) aus `pg_policies`. Sie ändert keine Policy und keine Daten und erzeugt keine Sicherheitsbewertung. Migration: `supabase/migrations/20261125160000_feature_security_policy_links.sql`.
- **Funktionsdetail im Katalog** zeigt je zugeordneter Tabelle den Live-Befund aus `audit_rls_gaps` (Severity, Begründung, Policy-Anzahl, `tenant_id`) und die Policies. Beides ist ausdrücklich als Sicherheitsbezug gekennzeichnet und von den funktionalen Testangaben getrennt.
- **Security-Cockpit** verlinkt jede Tabelle auf die betroffenen Funktions-IDs; der Deep-Link `?feature=<id>` öffnet die Funktion direkt im Katalog.
- **Generierter Index** `src/features/feature-catalog/generated/table-features.json` wird aus dem Inventar erzeugt und in `check:feature-catalog` auf Aktualität geprüft; das Cockpit lädt dadurch nicht den gesamten Katalog.
- **Keine pauschale Bewertung:** Es gibt weiterhin keine aggregierte Sicherheitsnote je Funktion. Ein fehlender Tabellenbezug oder ein fehlender Befund wird als solcher benannt, nicht als „sicher“ gewertet.

Aktualisierte Kennzahlen: 1.199 technische Zuordnungen, 538 wirksame Datenbankfunktionen, 468 referenzierte RPCs. Der Katalog bleibt bei 252 Funktionen; `check:feature-catalog` läuft mit 0 Fehlern und 0 Warnungen, die Katalogtests mit 26/26.

### Verifikation der Migration gegen eine lokale Datenbank

Ein lokaler PostgreSQL-Server war in dieser Umgebung nicht verfügbar: `psql`, `initdb` und `pg_ctl` fehlen, der Docker-Daemon antwortet nicht (`docker info` schlägt fehl). Die Migration wurde deshalb gegen eingebettetes PostgreSQL 17 (PGlite 0.6.0, WASM) mit nachgebautem Supabase-Minimalumfeld (`auth.uid()`, `public.has_role`, `authenticated`/`anon`, Tabellen mit RLS-Policies) ausgeführt. Ergebnisse:

- Migration lädt fehlerfrei.
- `pg_get_function_result` bestätigt exakt `TABLE(table_name text, policy_name text, command text, roles name[], permissive text, has_using boolean, has_check boolean)`.
- `roles` wird als String-Array (`["authenticated"]`) serialisiert, `permissive` liefert `PERMISSIVE`; die in `types.ts` deklarierten Typen (`string[]`, `string`) passen dazu.
- ACL nach der Migration: `postgres=X/postgres`, `authenticated=X/postgres`; `anon` hat keine EXECUTE-Berechtigung. Die Grants sind damit korrekt und nicht zu weit gefasst.
- `_tables`-Filter und `NULL` (alle Tabellen) funktionieren; ohne `abgeordneter`-Rolle bricht der Aufruf mit `forbidden` ab.

Eine Korrektur an `name[]`, `permissive` oder den Grants war nicht erforderlich. Die UI-Degradation bei fehlender Migration ist durch einen eigenen Test abgedeckt: Der Hinweis nennt die Migrationsdatei, der RLS-Befund bleibt sichtbar, und es wird keine Ersatzbewertung angezeigt.

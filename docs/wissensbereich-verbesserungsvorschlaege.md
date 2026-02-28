# Konkrete Vorschläge zur Überarbeitung/Erweiterung des Wissensbereichs

## 1) Codequalität stabilisieren (kurzfristig, 1–2 Sprints)

1. **Lint-Fehler auf "blockierend" stellen und systematisch abbauen**
   - Der aktuelle Lint-Lauf zeigt viele Hook-Abhängigkeitswarnungen sowie echte Fehler (u. a. `rules-of-hooks`, `no-case-declarations`, `no-empty`).
   - Vorgehen:
     - Erst die **harten Fehler** auf 0 bringen.
     - Dann Warnungen pro Modul (z. B. `KnowledgeBase`, `MyWork`, `Maps`) in kleinen PRs reduzieren.
     - In CI `npm run lint` als Pflichtcheck setzen.

2. **TypeScript schrittweise verschärfen**
   - Mehrere Sicherheitsnetze sind aktuell deaktiviert (`strict`, `strictNullChecks`, `noImplicitAny`).
   - Vorgehen:
     - Neue/angepasste Dateien mit lokalem `// @ts-check`-Niveau sauber halten.
     - Danach projektweit in Stufen: zuerst `strictNullChecks`, dann `noImplicitAny`, zuletzt `strict`.

3. **Versionen React/Types synchronisieren**
   - Runtime nutzt React 19, die Typ-Pakete stehen noch auf React-18-Typen.
   - Das erhöht die Chance auf subtile Typfehler oder inkonsistente IDE-Hinweise.

## 2) Fehler- und Risikoquellen im Wissensbereich (mittel, 2–4 Sprints)

1. **N+1-Abfrage bei Autorennamen vermeiden**
   - In `KnowledgeBaseView` werden Profile pro Dokument einzeln abgefragt.
   - Verbesserung:
     - `select` mit Join/View verwenden oder Profilnamen in einem Batch laden.
     - Ergebnis: weniger DB-Roundtrips, schnellere Listenansicht.

2. **Echtzeit-Aktualisierung effizienter machen**
   - Der Realtime-Listener lädt nach jeder Änderung die komplette Dokumentliste neu.
   - Verbesserung:
     - Event-spezifische Updates (`INSERT`, `UPDATE`, `DELETE`) lokal in State mergen.
     - Optional Debounce/Throttle für Burst-Änderungen.

3. **WebSocket-Auth im Collaboration-Endpoint wirklich prüfen**
   - Der Endpoint verlangt zwar einen Token-Parameter, validiert ihn aber nicht sichtbar vor dem Upgrade.
   - Verbesserung:
     - JWT gegen Supabase Auth verifizieren.
     - Zugriff auf Dokument + Tenant prüfen, bevor die Verbindung akzeptiert wird.

## 3) Feature-Ausbau für „Wissen“ (produktseitig priorisiert)

1. **Inhaltsqualität & Governance**
   - Einführung von Statusfluss: `draft -> review -> published -> archived`.
   - Pflichtfelder für publizierte Artikel (Titel, Kurzbeschreibung, Themen, verantwortliche Person, Review-Datum).
   - „Stale Content“-Hinweis ab z. B. 90 Tagen ohne Aktualisierung.

2. **Bessere Auffindbarkeit**
   - Ranking: exakte Titel-Treffer > Themen-Treffer > Volltext.
   - Facettenfilter (Thema, Autor:in, Aktualisiert am, Veröffentlichungsstatus).
   - Gespeicherte Suchen/Ansichten pro Nutzer:in.

3. **Zusammenarbeit & Nachvollziehbarkeit**
   - Versionshistorie mit Diff-Ansicht pro Artikel.
   - Kommentar-Threads auf Absatzebene.
   - „Wer arbeitet gerade daran“-Präsenz + Konflikt-Hinweise beim parallelen Editieren.

4. **Wissens-Wirkung messbar machen**
   - Kennzahlen: Suchanfragen ohne Treffer, Top-Artikel, veraltete Artikel, mittlere Zeit bis Veröffentlichung.
   - Dashboard für Redaktionsverantwortliche inkl. monatlicher Aufgabenliste.

## 4) Empfohlene Umsetzung als 90-Tage-Plan

### Phase 1 (Tag 1–30)
- Lint-harte Fehler auf 0.
- Quick-Wins in `KnowledgeBaseView` (N+1 reduzieren, Realtime nicht mehr Full-Reload).
- Collaboration-Token validieren.

### Phase 2 (Tag 31–60)
- Review-Workflow + Pflichtmetadaten.
- Verbesserte Suche + Facettenfilter.
- Erste Qualitätsmetriken.

### Phase 3 (Tag 61–90)
- Versionshistorie mit Diff.
- Gespeicherte Suchen und personalisierte Wissens-Startseite.
- TypeScript-Schärfung beginnen (`strictNullChecks` als erster Meilenstein).

## 5) Definition of Done (damit Qualität dauerhaft bleibt)

- Lint in CI grün und blockierend.
- Für Wissensfunktionen: Smoke-Tests für „Erstellen, Freigeben, Suchen, Bearbeiten“.
- Jede Wissens-Änderung mit Migrations-/Rollback-Plan (DB + UI + Edge Functions).
- Monatliches Review der Wissensmetriken mit klaren Folgeaufgaben.

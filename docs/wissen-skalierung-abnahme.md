# Wissen: Skalierung und Abnahme

Die Umsetzung baut auf dem Q&A-Stand von `main` auf. `KnowledgeBaseView.tsx`, die Altroute `/knowledge/:id` und die bisherigen Migrationen bleiben unverändert. Jeder der acht Arbeitsschritte hat einen eigenen Commit.

| Schritt | Ergebnis |
| --- | --- |
| 1 | Listen-RPC mit gekürzter Beschreibung und Antwortauszug; vollständige Antwort nur über den Detail-Hook. Kein Lexical-Editor in eingeklappten Karten. 60 Sekunden staleTime, Fokus-Refetch und mandantengefilterte Realtime-Invalidierung. |
| 2 | Cursor aus Aktualisierung/ID bzw. Rank/ID; explizite Gesamtzahl und nächster Cursor; Infinite Query mit „Mehr laden“. |
| 3 | Gespeicherte deutsche Suchvektoren: Titel A, Beschreibung B, Antwort C. Normalisierte Umlautvarianten, Trigram-Fallback, gespeicherter Titelvektor, getrennter Browse-Pfad und partieller Index für beantwortete Fragen. Gemessene Pläne in `wissen-query-plans.md`. |
| 4 | Zugewiesene Fragen, geschützte Prüfungsansicht, URL-Filter, serverseitige Whitelists, eigener Counts-Aufruf und Beitragsindex. Suche sortiert nach Relevanz; die Datumssortierung gilt beim Browsen. |
| 5 | Bis zu drei beantwortete Vorschläge im Fragedialog, 300 ms Debounce ab vier Zeichen, mit Auszug und Link. Das Stellen der Frage hängt nicht vom Vorschlagsabruf ab. |
| 6 | Serverseitige Benachrichtigungen für Zuweisung, erste Antwort, fälligen Prüftermin und Prüfungsanforderung. Bestehende Einstellungen und Tabellen, mandantengebundene Typen, dauerhafte Zustellschlüssel. Fälligkeiten: maximal 500 pro Lauf, bei vorhandenem pg_cron alle 15 Minuten. |
| 7 | AssigneeSelect, ReviewPanel, HistoryPanel; ein gemeinsamer, an Serverzeit gebundener Timer. Verlauf nach Revision paginiert. Nullable RPC-Argument ohne ts-expect-error. Vollständige historische Snapshots bleiben zur Rückwärtskompatibilität erhalten. |
| 8 | Pflege mit knowledge.manage, standardmäßig Abgeordnete/Büroleitung: Titel/Beschreibung ändern, archivieren und als Duplikat schließen. Source- und Zielrevision werden geprüft, Ziele liegen im selben Büro; Daten und Audit bleiben erhalten. Archivierte Fragen fehlen in Listen, Zählern und Fälligkeitsversand. |

## Prüfungen

- `npm run typecheck:knowledge`
- `npx vitest run src/features/knowledge src/features/selftest/scenarios/knowledge-lifecycle.test.ts src/utils/__tests__/notificationDeepLinks.test.ts` (26 Tests)
- `node scripts/test-knowledge-qa.mjs`: isoliertes PostgreSQL/PGlite mit echten Migrationen und Rollen; jede neue Migration wird zweimal ausgeführt. Geprüft werden unter anderem RLS, Fremdbüro-Zugriff, gesperrte Schreib-/Prüf-/Pflegeaktionen, veraltete Revisionen, kompakte Payloads, Cursor, Suchvarianten, Einstellungen, Duplikatsperre und Archiv-/Merge-Audit.
- Chromium: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm --prefix e2e test -- --project=knowledge`. Desktop und 390px mobile Ansicht, kein horizontaler Überlauf. Editor erst nach Aufklappen, Revisionskonflikte, Bearbeiten, Duplikat-Verweis und Archivierung eingeschlossen. Der Browsertest nutzt einen simulierten API-Server; die SQL-Rechte werden unabhängig in PostgreSQL geprüft.
- ESLint für die geänderten Komponenten, Hooks und Regeln ohne Warnungen.
- Selbsttest-Center: zusätzliche Szenarioschritte für kompakte Seiten, URL-Filter, Benachrichtigungszustellung samt Wiederholungs-/Einstellungsprüfung und Pflegeablauf. Server-Selbsttests rollen alle Geschäftsdaten, Zustellungen und Benachrichtigungen zurück.
- Selbsttest-Coverage-Bericht und Schema-Snapshot aktualisiert.

## Grenzen und Betrieb

- Der gemessene Browse-Pfad verwendet den Index. Der FTS-Pfad verwendet unter RLS in der isolierten Messung weiterhin einen Sequential Scan trotz GIN-Index. Es wurde kein RLS-Bypass und keine Änderung an PostgreSQL-Systemoperatoren eingeführt, um einen Indexplan zu erzwingen. Produktionspläne müssen nach Anwendung der Migrationen mit repräsentativen Daten geprüft werden. Exakte Gesamtzahlen erfordern weiterhin die Zählung aller passenden Zeilen.
- Synonymwörterbuch ist optional und wurde nicht ergänzt.
- Die Duplikat-Auswahl in der Oberfläche sucht vorhandene Antworten. Die Quellantwort wird archiviert und mit der Zielfrage verknüpft; Texte, Anhänge und Verläufe werden nicht automatisch vermischt.
- Die neuen Migrationen werden im üblichen Supabase-Releaseprozess angewendet. Diese Arbeit führt keine SQL-Änderungen auf der produktiven Datenbank aus. pg_cron und Realtime müssen in der Zielinstallation verfügbar sein; ihre Einrichtung in den Migrationen ist bedingt und wiederholbar.
- Der zusätzliche allgemeine Notification-Typecheck stößt im bestehenden Projekt auf das leere `@types/react-grid-layout`-Stubpaket. Mit expliziten Type-Libraries bleibt die bereits bestehende Nullability-Stelle `currentEndpoint` in `useNotifications.tsx`. Der geforderte Wissen-Typecheck ist grün; diese unabhängigen Probleme wurden nicht mit sachfremden Änderungen überdeckt.

## Reparatur bei SQLSTATE 42501 für pg_trgm.word_similarity_threshold

Die Funktionsdefinitionen in `…100200`, `…100300` und `…100500` enthielten eine `SET pg_trgm.word_similarity_threshold`-Klausel. Die Zielinstallation kann das Setzen dieses Parameters verweigern. Die neue Datei `20261111100600_knowledge_manage_trigram_recovery.sql` verwendet deshalb den direkten Vergleich `word_similarity(...) >= 0.35`, ohne Extension-Parameter zu setzen. Der Trefferfilter ist damit auch unabhängig vom Zustand einer gepoolten Verbindung. RLS und SECURITY INVOKER bleiben erhalten. Der direkte Vergleich fordert keinen thresholdabhängigen Trigram-GIN-Scan an.

Wenn `…100400` erfolgreich ist und `…100500` im SQL-Editor fehlschlägt, den **gesamten Inhalt von `…100600` anstelle der fehlgeschlagenen `…100500` ausführen**. Die Reparatur wiederholt bewusst alle idempotenten Pflege-DDLs, da die fehlgeschlagene Ausführung vollständig zurückgerollt sein kann. Sie funktioniert auch, wenn `…100500` bereits vollständig oder teilweise ausgeführt wurde. Frühere Migrationsdateien werden nicht verändert.

Ein automatischer Migrationslauf, der bereits an `…100500` anhält, erreicht die spätere Reparatur nicht automatisch: Die Reparatur muss zunächst als vollständiger SQL-Lauf angewendet werden; erst nach erfolgreicher Prüfung darf die fehlgeschlagene Version im verwendeten Migrationstool als angewendet markiert werden. Diese Arbeit ändert keine produktiven Migrations-History-Einträge. Die Reparatur setzt die erfolgreich angewendeten Vorgänger bis `…100400` voraus.

Regressionstest für den Rollback-Fall: `KNOWLEDGE_SKIP_FAILED_MANAGE=1 node scripts/test-knowledge-qa.mjs`. Dabei wird `…100500` vollständig ausgelassen und die Reparatur zweimal angewendet. Zusätzlich wird geprüft, dass die reparierte RPC keine pg_trgm-Konfiguration enthält und ihre Tippfehlertreffer auch bei einem abweichenden Session-Schwellwert unverändert liefert.


## Schritt 10: Personenavatare

`KnowledgePersonAvatar` verwendet die bestehende Avatar-Basiskomponente mit 24 px, Initialen, einer stabil aus der User-ID gewählten Hintergrundfarbe und einem gestrichelten Fragezeichen für „Nicht zugeordnet“. Die Avatare sind dekorativ; Namen bleiben daneben als Text sichtbar. Die neuen Komponenten werden bei „Gefragt von“, „Zuständig“ und „Bestätigt von“ eingesetzt, einschließlich der Zuständigkeitsoptionen im bestehenden Radix-Select. Suchtreffer, Suchvorschläge und Verlauf bleiben ohne Avatare. Mehrere Beteiligte an derselben Rolle werden nicht neu eingeführt; für einen solchen Ausbau steht weiterhin `AvatarStack.tsx` bereit.

Die neue Migration `20261111100700_knowledge_person_avatars.sql` ergänzt die bestehenden invoker-Views um `created_by_person`, `assigned_to_person` und `verified_by_person`, jeweils mit `user_id`, `display_name` und `avatar_url`. Die Listen-RPC serialisiert diese begrenzten Objekte bereits über ihren bestehenden Seitenauszug. Im Detail werden dieselben Felder mit der ohnehin nötigen Detailabfrage geladen. Profil-Joins sind auf den Tenant der Frage beschränkt und unterliegen den vorhandenen Profil-RLS-Policies; nicht verfügbare Profile liefern keine fremden Namen oder URLs. Die gemeinsame, gecachte Profilliste liefert auch für die Select-Optionen die Avatar-URL. Es gibt keine Profilabfrage pro Karte.

Bilder erhalten `loading="lazy"` und leeren Alternativtext. Weil Radix Bilder selbst vorlädt, wird `AvatarImage` zusätzlich erst in der Nähe des sichtbaren Scrollbereichs gemountet. Ein Bildfehler lässt die Initialen sichtbar. Tests prüfen diesen verzögerten Abruf, dekorative Semantik, fehlende Zuordnung, stabile Farben, reine Textdarstellung bei Suchtreffern und revisionsgeprüfte Auswahl/Löschung der Zuständigkeit. Die PostgreSQL-Tests prüfen Metadaten in Liste und Detail, Bürogrenzen und wiederholte Migrationen. Der Browsertest prüft zusätzlich Tastaturöffnung, bebilderte Optionen, lazy-Bildattribute, mobile Breite und unveränderte Profilabfragezahl beim Aufklappen.

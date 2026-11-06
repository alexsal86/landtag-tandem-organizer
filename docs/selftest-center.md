# Selbsttest-Center

Das bestehende Center unter `/selftest` bleibt der Einstieg für interaktive Prüfungen. Es unterscheidet Geschäftsregeln, Datenbankprüfungen und Fachabläufe über Anwendungsfunktionen. Ein grüner Lauf bestätigt nur seinen angezeigten Prüfumfang.

## Bedienung

- Einzelne Szenarien oder eine Suite starten: alle Szenarien, reine Geschäftsregeln, Datenbank/Fachabläufe oder Zugriffsschutz.
- Szenarien laufen nacheinander. Ein fehlgeschlagenes Szenario verhindert die übrigen nicht. Abhängige Schritte innerhalb eines Szenarios werden übersprungen.
- „Nach diesem Schritt stoppen“ wartet die laufende Operation ab und räumt anschließend auf. Es gibt keinen scheinbaren Timeout, nach dem noch unkontrolliert Schreiboperationen weiterlaufen.
- Fehlende Anmeldung, Mitgliedschaft oder notwendige Rolle ergibt „Voraussetzung fehlt“, niemals „Bestanden“.
- Demo-Daten werden nur bei vollständig erfolgreichem Lauf behalten. Fehlerhafte oder abgebrochene Demos werden aufgeräumt.
- Berichte enthalten Lauf-ID, Benutzer/Büro, Ursprung, optional `VITE_COMMIT_SHA`, Einzelprüfungen, Soll/Ist-Details und Aufräumergebnis. Sie sind pro Benutzer und Büro im Browser gespeichert und als JSON exportierbar. Zusätzlich bleibt der gemeinsame serverseitige Verlauf im Büro mit Vergleich zum vorherigen Lauf erhalten. Die lokale Historie hält die IDs für Wiederherstellung und Cleanup bereit.

## Testdaten und Wiederherstellung

Alle Szenarien registrieren erzeugte IDs sofort beim Runner; Dateien werden vor dem Upload registriert. Die Historie behält unaufgeräumte Läufe auch über die Begrenzung auf 20 abgeschlossene Läufe hinaus. Fehlgeschlagene lokale Speicherung wird sichtbar gemeldet.

Cleanup arbeitet anhand dieser IDs und Dateipfade. Antworten werden vor Teilnehmern, Kinder vor Eltern entfernt. Bei einem wirkungslosen DELETE wird per erneutem Lesen geprüft, ob ein Datensatz übrig ist. Ein Cleanup-Fehler lässt den Lauf fehlschlagen.

„Ältere eigene Testdaten suchen“ findet vor dem Umbau oder in einem anderen Browser erzeugte Demo-Daten anhand von Marker, Büro und Ersteller. Die Suche löscht nichts; gefundene IDs werden als aufräumbarer Lauf aufgezeichnet. Unmarkierte alte Tageszettel werden dabei nicht pauschal gelöscht.

Für Briefe werden zugehörige Archivdokumente, Anlagen, Archivdateien und Folgeaufgaben zusätzlich über den aufgezeichneten Brief ermittelt. Für Vorgänge werden erzeugte Büro-Aufgaben, für Terminanfragen erzeugte Termine nachgeladen. So können auch unterbrochene RPC-/Archivschritte aufgeräumt werden. Scheitert die Ermittlung, bleibt der Elternsatz für einen weiteren Versuch erhalten. Schreibgeschützte Übergabeprotokolle werden über den Testvorgang per CASCADE entfernt.

Tageszettel verwenden gültige, aus der Lauf-ID abgeleitete Tage zwischen den Jahren 3000 und 9000. Bei einer Kollision scheitert der INSERT; bestehende Tageszettel werden nicht vorab gelöscht oder überschrieben.

Für vollständige Läufe ein separates Testbüro verwenden. Ein Verbindungsabbruch vor Empfang und Registrierung einer serverseitig vergebenen INSERT-ID bleibt eine Grenze der browserseitigen Wiederherstellung; dauerhafte Testumgebungen sollten zusätzlich serverseitige Testlauf-Zuordnung und Bereinigung vorsehen.

## Tatsächliche Anwendungspfade

- Brief: Editor und Center teilen `src/services/letterWorkflow.ts`. Geprüft werden echter Datei-Upload/Download, `draft → review → pending_approval → approved`, die vorhandene Archivfunktion, PDF-Signatur, Archivverknüpfung und Folgeaufgabe. Ein fehlgeschlagenes Speichern wird im Editor nicht mehr als erfolgreicher Statuswechsel angezeigt.
- Vorgang: Übergabe erfolgt über `handover_case_items` an eine zweite aktive Person. Der Test prüft die vom Trigger erzeugte Protokollzeile. Büro-Aufgaben aus Vorgangsschritten werden ebenfalls aufgeräumt.
- Terminanfrage: Anfangsstatus `open`, Sperre direkter Statusänderungen, Zusage über `decide_appointment_request`, Terminverknüpfung und abgewiesene Wiederholung ohne zweiten Termin.
- Zugriffsschutz: RLS-Schreibsperre bei nicht zugehöriger Büro-ID und tatsächliche Entscheiderrolle des angemeldeten Kontos. Für beide Seiten der Rollenmatrix mit Büroleitung/Abgeordneten und Mitarbeiterkonto ausführen.

Reine Geschäftsregeln brauchen keine Anmeldung und keinen Datenbankzugriff. Die reguläre Route `/selftest` bleibt durch die Anmeldung geschützt.

## Abdeckung

`npm run update:selftest-coverage` liest Tabellen aus den generierten Supabase-Typen und Szenarien über den TypeScript-Parser. Es aktualisiert Schema-Snapshot, UI-Daten und `docs/selftest-coverage.md`. Nur in der Registry enthaltene Szenarien zählen.

„Szenario vorhanden“, „Ausbau offen“ und „ausgenommen, nicht geprüft“ sind getrennt. Deklarierte Tabellen/Schreibfelder sind keine gemessene Code-Coverage und kein Nachweis eines bestandenen Laufs. Neue nicht eingeordnete Tabellen, unbekannte Szenario-Tabellen und veraltete Berichte lassen `npm run check:selftest-coverage` fehlschlagen. Bestehende offene Fachbereiche bleiben sichtbar, ohne ein vollständiges Testversprechen abzugeben.

## Lokale Prüfungen und CI

```sh
# Der vorhandene ESLint-Peer-Versionskonflikt erfordert aktuell dieses Installationsflag.
npm ci --legacy-peer-deps
npm run check:selftest-coverage
npm run test:selftest:coverage-check
npm run typecheck:selftest
npm run test:selftest
npm run build
```

Die eigenständige CI in `.github/workflows/selftests.yml` führt diese Center-Prüfungen und den öffentlichen Browsertest verbindlich aus. Fehlgeschlagene Prüfungen werden nicht automatisch heruntergestuft. Die übrige Projekt-CI und ihre breitere Testsuite bestehen daneben weiter.

Die bisherigen Speichersimulationen heißen ausdrücklich Modell-Smokes (`npm run test:model-smoke`). Bestehende `test:e2e:smoke-*`-Aufrufe bleiben als Kompatibilitätsaufrufe erhalten und weisen in ihrer Ausgabe auf den simulierten Umfang hin. Echte Browsertests laufen mit `npm run test:e2e`.

## Browsertests

```sh
npm ci --prefix e2e
npx --prefix e2e playwright install chromium
npm run test:e2e -- --project=public
```

Ohne `E2E_BASE_URL` startet Playwright den lokalen Vite-Server. Der öffentliche Test kontrolliert die Anmeldungssperre. Bei bereits installiertem Chromium lässt sich dessen Pfad mit `PLAYWRIGHT_CHROMIUM_EXECUTABLE` setzen.

Die Live-Suite meldet sich über die echte Anmeldeseite an, wählt das konfigurierte Büro, startet die drei Fachabläufe im Center und prüft Ergebnis, Cleanup, Berichtsexport und Wiederherstellung nach Neuladen. Zugriffsschutz läuft mit beiden Rollen. Es werden keine Backend-Antworten gemockt. Damit wird die Bedienung des Centers mit tatsächlichem Backend geprüft; Klickpfade durch sämtliche Fachoberflächen, ein realer E-Mail-Versand und externe Kalenderanbieter sind weiterhin eigene Ausbaustufen.

Erforderliche Umgebungsvariablen bzw. GitHub-Secrets:

| Name | Inhalt |
|---|---|
| `E2E_BASE_URL` | URL der Anwendung mit Testbüro |
| `E2E_TENANT_ID` | ID des ausschließlich für die Tests vorgesehenen Büros |
| `E2E_LEAD_EMAIL`, `E2E_LEAD_PASSWORD` | Testkonto mit Rolle `bueroleitung` oder `abgeordneter` |
| `E2E_STAFF_EMAIL`, `E2E_STAFF_PASSWORD` | Zweites Testkonto mit Rolle `mitarbeiter`, im selben Testbüro |

Beide Konten müssen aktive Mitglieder des Testbüros sein. Die Live-Suite läuft explizit mit `E2E_LIVE=1 npm run test:e2e -- --project=live` oder über den manuellen Workflow mit `run_live=true`. Fehlt dann die Konfiguration, schlägt der Aufruf fehl. Ohne Aktivierung sind Live-Tests als übersprungen ausgewiesen. Passwörter gehören nicht in eingecheckte Dateien. Live-Tests speichern keine Browsertraces, Videos oder Session-Dateien mit Zugangsdaten.

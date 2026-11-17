# Problemfälle und Landeslisten in der Wahldatenverwaltung

Einmalig die Migration
`supabase/migrations/20261117180000_election_history_quality_and_state_lists.sql`
ausführen. Sie ergänzt zwei zentrale, rollenbeschränkte Listentabellen und die
paginierten Such-/Prüf-RPCs. Bestehende Mandate, Ergebnisse und Personen werden
nicht importiert, überschrieben oder neu angelegt.

## Problemfälle

Der Reiter zeigt standardmäßig alle Legislaturperioden. Filter: Datenbereich,
Periode, Problemart und Name/Wahlkreis; Sortierung nach Problemart, Periode oder
Bezeichnung. Es werden höchstens 50 Hinweise pro Seite übertragen. Ein Datensatz
kann mehrere Hinweise haben. „Quelle fehlt“ und „Keine Einträge / leerer Bereich“
sind getrennte Kategorien. Weitere Hinweise betreffen fehlende Datumsangaben,
Direktmandatszuordnungen, Personenverbindungen und Kandidaturergebnisse.

Ein Klick öffnet den betroffenen Datensatz bereits in der Bearbeitung, auch wenn
er außerhalb der ersten 100 Tabellenzeilen liegt. Bei leeren Datenbereichen öffnet
er den entsprechenden Reiter. Listenfilter bleiben bei der Rückkehr erhalten.
Nach dem Speichern werden die Hinweise aus dem aktuellen Datenstand neu berechnet.
Eine leere Hinweisliste ist keine Vollständigkeitsbescheinigung historischer Daten.

## Landeslisten

Ab der 18. Legislaturperiode: Periode wählen, Landesliste je Partei anlegen,
Quelle/Anmerkungen ergänzen und Listenplätze mit Namen erfassen. Listenplätze
und bereits zugeordnete Personen können innerhalb derselben Liste nicht doppelt
belegt werden. Ohne Treffer können auch neue Kandidierende erfasst werden;
ihr Name bleibt ohne Personenverbindung stehen.

Die Namenssuche berücksichtigt historische Mandatsnamen und verknüpfte zentrale
Personennamen über alle Perioden. Nur genau eine bestehende Verbindung mit exakt
gleichem Namen wird automatisch zugeordnet; Groß-/Kleinschreibung und äußere
Leerzeichen werden normalisiert. Ähnliche Namen oder eine gleiche Partei sind
keine ausreichende Zuordnung. Bei mehreren exakten Identitäten bleibt die Auswahl
offen. Treffer zeigen die bisherigen Parteien und Legislaturperioden und können
explizit ausgewählt werden. Historische Listen-Namensangaben bleiben dabei erhalten.

Die Datenbank wiederholt die Prüfung beim Speichern, unabhängig von der
Browser-Vorschlagsliste. Spätere Mandatsimporte/-korrekturen aktualisieren
automatische oder offene Zuordnungen. Ausdrücklich ausgewählte Verbindungen
bleiben erhalten. Vollständige bestätigte Zusammenführungen von Mandatshistorien
führen Listenverweise mit; bei einem Konflikt durch eine doppelte Listenperson
bleibt der betroffene Eintrag erhalten und wird als offene Zuordnung angezeigt.

Die Landesliste ist eine Aufstellung, kein tatsächliches Mandat und kein persönliches
Wahlergebnis. Sie verändert weder `election_history_candidacies` noch Stimmen,
Mandatszeiten, Karten oder Wiederwahlzählungen. Der Button „Mandatshistorie“
öffnet die bereits zugehörige Personengruppe im Gesamtregister.

Nur Super-Admins schreiben. Tenant-Lesezugriffe auf die neuen Tabellen sind auf
freigegebene Legislaturperioden begrenzt. Problemübersicht und Namensvorschläge
sind ausschließlich für Super-Admins zugänglich; Audit-Trigger protokollieren die
Listenschreibvorgänge. Für diese Erweiterung sind weder zusätzliche Secrets noch
Edge Functions erforderlich.

# Zusammengeführte Mandatshistorien

Die Zuordnung erfolgt auf ausdrücklichen Nutzerauftrag über die Migration
`20261116220000_complete_reviewed_deputy_histories.sql`. Sie enthält die 2.542
stabilen Mandats-IDs aus dem vorhandenen Abgeordnetenimport
`20261114110000_historical_election_members.sql`, zusammengefasst zu 1.049 Historien.
Die Gruppierung ist unabhängig von Partei-/Fraktionsbezeichnungen. Bestätigte
widersprüchliche Personen-IDs werden nicht überschrieben; die Migration meldet
betroffene Namen als PostgreSQL-Warnung. Personenregister, Mandatsart, Zeiträume,
Wahlkreiszuordnung und Quellenbezeichnungen bleiben unverändert.

Bestehende Verbindungen werden als Ganzes übernommen. Die vorhandene Verbindung
mit Salomons Porträt bleibt erhalten; sonst wird die Verbindung der frühesten
Periode bevorzugt. Mandatspausen sind keine neuen Personen. Insbesondere bleiben
Ulrich Goll und Winfried Hermann auch über ihre dokumentierten Pausen verbunden.

## Geprüfter Namensvetter

Friedrich Haag (1930) aus den Perioden 4–10 und Friedrich Haag (1989) aus Periode 17
sind Großvater und Enkel. Die alte Regel „gleicher Name und gleiche Fraktion“
konnte beide verbinden. Die Migration trennt den jüngeren importierten Eintrag
gezielt, bevor die übrigen Historien zusammengeführt werden.

Quellen:
- [Landtag: Friedrich Haag, geboren 1989](https://www.landtag-bw.de/resource/blob/210758/abc5b6a1cce5b96e7342315a1a02d7ac/Haag_Friedrich.pdf)
- [Vita des jüngeren Friedrich Haag](https://www.friedrich-haag.de/verweise/)
- [Friedrich Haag (1930), Mandatszeiten](https://de.wikipedia.org/wiki/Friedrich_Haag_(Politiker,_1930))
- [Ulrich Goll: Mandate 1988 sowie 2006, 2011, 2016](https://fdp-landtag-bw.de/einladung-verleihung-reinhold-maier-medaille/)

## Neue Einträge

Ein neuer Eintrag übernimmt eine eindeutig vorhandene Verbindung derselben
bestätigten Person. Ohne bestätigte Person wird nur eine einzige vorhandene
Historie mit exakt gleichem, hinsichtlich Leerraum und Großschreibung
normalisiertem Namen verwendet. Mehrdeutige Namen oder bereits belegte Perioden
werden nicht automatisch verbunden. Es wird keine Personenidentität erzeugt.

## Wahlkreise und Wahlanalyse

Die historischen Wahlkreise ordnen Mandate und Kandidaturen der jeweiligen
Legislaturperiode zu. Die Wahlanalyse verwaltet Stimmen und Wahlergebnisse
getrennt. `election_analysis_versions.historical_district_id` mit
`history_link_verified` verknüpft einen Wahlkreis derselben Wahl mit den
freigegebenen Mandaten für den Steckbrief. Das bestätigt keine Gleichheit der
Wahlkreisgrenzen über verschiedene Jahre; Nummern allein reichen dafür nicht.

## Auslieferung

Ein Git-Push wendet keine Supabase-Migration an. Die Migration muss über den
Datenbank-Deploymentprozess eingespielt werden. Ohne Datenbankzugang lässt sich
der Live-Stand nicht aus dem Repository bestätigen.

## Wiederholung nach einem Überlappungsfehler

Die überarbeitete Migration `20261116220000_complete_reviewed_deputy_histories.sql`
setzt die beiden Datumstrigger vor der Zusammenführung auf fachlich relevante
Spalten. Eine Änderung nur an `connection_id` löst weder Datumsvererbung noch
Überlappungsprüfung aus. Das funktioniert auch, wenn auf der Datenbank noch ältere
Versionen der Triggerfunktionen installiert sind. Neue Mandate und Änderungen an
Person, Kandidatur, Wahlkreis, Mandatsart, Eintritt, Datumswerten,
Vererbungskennzeichen, vorzeitigem Ausscheiden oder Notizen werden weiterhin
geprüft. Audit und Berechtigungen bleiben aktiv.

Ist die Zusammenführung mit einem Fehler abgebrochen, die vollständige korrigierte
Migration erneut ausführen. Sie läuft als einzelner atomarer `DO`-Block; eine zuvor fehlgeschlagene
Transaktion muss zuerst zurückgerollt werden (`ROLLBACK;`, falls die SQL-Sitzung
noch den Zustand „transaction is aborted“ meldet).
Für bereits erfolgreich migrierte Installationen liefert
`20261116230000_scope_mandate_date_trigger_events.sql` dieselbe Triggerkorrektur
als eigene Folgemigration.

## Fehlende temporäre Zuordnungstabelle

`reviewed_deputy_members` ist eine temporäre Tabelle mit `ON COMMIT DROP`.
Sie ist nach einem Commit oder in einer anderen Datenbanksitzung nicht mehr
verfügbar. Die Migration besteht deshalb jetzt aus genau einem vollständigen
`DO $deputy_histories$ … $deputy_histories$;`-Block. Er installiert die Trigger,
erstellt und füllt die Zuordnungstabelle, verarbeitet alle Verbindungen und
installiert die künftige Zuordnung atomar innerhalb einer SQL-Anweisung. Dadurch
kann zwischen Erstellung und Verwendung kein Autocommit des SQL-Editors liegen.

Nach einem Fehler die **vollständige aktuelle Datei** ausführen, vom öffnenden
`DO` bis zum abschließenden `$deputy_histories$;`. Ein zuvor markierter Ausschnitt
enthält möglicherweise nicht die Erstellung der Tabelle. Bereits erfolgte
Zuordnungen bleiben beim erneuten Durchlauf stabil.

## Automatische Verbindung der Wahlkreise zur Wahlanalyse

`20261116233000_auto_link_election_history_districts.sql` verknüpft alle vorhandenen
Analysejahre mit der passenden Legislaturperiode und deren Wahlkreisen. Dafür
müssen Wahljahr, Periodennummer und eindeutige Wahlkreisnummer übereinstimmen.
Das gilt insbesondere für 2021/17. und 2026/18. Periode. Mandate sind bereits über
`district_id` mit den historischen Wahlkreisen verbunden; sie werden nicht erneut
zugeordnet, dupliziert oder aus Ergebnissen abgeleitet.

Die Migration läuft als eine SQL-Anweisung. Sie ergänzt fehlende
`election_analysis_versions`-Metadaten, setzt `historical_district_id` und
`history_link_verified` für eindeutige Beziehungen und installiert Trigger für
künftige Importe. Analysejahr und historische Wahlkreise können in beliebiger
Reihenfolge eintreffen. Bestehende widersprüchliche Verweise werden nicht
überschrieben, aber nicht länger als bestätigt ausgegeben. Eine nachträgliche
Änderung an Periode oder Wahlkreisnummer aktualisiert den Verbindungsstatus.
Alle Funktionen arbeiten mit den vorhandenen Berechtigungen (`SECURITY INVOKER`).

Die Oberfläche zeigt nur den Status und offene Datenkonflikte. Eindeutige
Verbindungen benötigen keine Bestätigung. Freigabe und bestehende Leserechte
bestimmen weiterhin, welche Mandate andere Nutzer sehen. 1952 mit seinen
regionalen Nummern bleibt von der landesweiten Nummernzuordnung ausgenommen.
Es werden keine Personenidentitäten, Kandidaturen, Stimmen, Mandate oder
jahresübergreifenden Grenzidentitäten erzeugt; `geography_id` und `identity_key`
bleiben unverändert.

### Korrektur der SQL-Parameterauflösung

Die erste Fassung des Matchers verwendete `y.year=election_year`. In einer
SQL-Funktion hat die gleichnamige Spalte `p.election_year` Vorrang vor dem
Parameter. Dadurch wurde nicht zuverlässig auf das angeforderte Jahr begrenzt;
der folgende Guard wies den fremden Wahlkreis korrekt zurück.
Die korrigierte Fassung verwendet ausschließlich `$1` (Jahr) und `$2`
(Wahlkreisnummer). Die SQL-Funktion ist `VOLATILE`, damit auch gerade in der
aufrufenden Anweisung gesetzte Periodenverknüpfungen sichtbar sind.
Die Prüfungen für historische Zuordnung, Geometriejahr und verifizierte
Grenzidentitäten bleiben unverändert aktiv.

Nach einer fehlgeschlagenen Erstinstallation den vollständigen korrigierten
Block `20261116233000_auto_link_election_history_districts.sql` erneut ausführen.
Für bereits installierte Datenbanken repariert die eigenständige Folgemigration
`20261116233100_fix_history_district_match_arguments.sql` den Matcher und führt
die Zuordnung erneut aus.

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

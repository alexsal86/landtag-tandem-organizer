# Kandidierende und spätere oder frühere Mandate

Die Migration `20261117200000_candidate_person_careers.sql` ergänzt die
Super-Admin-RPCs für das Personenverzeichnis, die ausgewählte Laufbahn und das
explizite Anlegen neuer kandidierender Personen. Es werden keine bestehenden
Personen, Kandidaturen, Ergebnisse oder Mandate zusammengeführt oder verändert.

## Wahlkreise und Kandidaturen

Die Wahlkreistabelle zeigt zusätzlich alle tatsächlich erfassten Kandidaturen
mit Partei, Wahlausgang, persönlichen Ergebnissen und dem getrennten Status
eines etwaigen Mandats derselben Person in dieser Periode. „Nicht gewählt“
schließt ein späteres Nachrücken nicht aus. Eine erst in einer anderen Periode
gewählte Person bleibt in der früheren Periode erfolglose Kandidatin bzw.
erfolgloser Kandidat. Fehlende Ergebnisse bleiben offen.

„Kandidaturen pflegen“ öffnet den Kandidaturreiter mit dem betreffenden Wahlkreis
als Filter. Neue Einträge übernehmen diesen Wahlkreis. Ein Klick auf den Namen
öffnet die chronologische Personenlaufbahn über alle Perioden.

Im Kandidatureditor wird zuerst das zentrale Personenregister durchsucht. Es
enthält auch Menschen ohne jemals erfasstes Mandat. Bei Namensgleichheit lässt
sich die vorhandene Laufbahn prüfen; Namen oder eine gleiche Partei erzeugen
keine automatische Personenverknüpfung.

Fehlt die Person, kann sie mit „Neue kandidierende Person“ ausdrücklich angelegt
und ausgewählt werden. Bei bereits vorhandenem gleichen Namen verlangt der
Server einen Identifikationshinweis. Die Person ist dann zentral gespeichert;
die Kandidatur wird anschließend mit dem normalen Speichern abgeschlossen.
Auch bei abgebrochener Kandidatur bleibt die bereits bewusst angelegte Person
im Personenverzeichnis verfügbar, statt bei einem erneuten Versuch nochmals
angelegt werden zu müssen.

## Gemeinsame Laufbahn

Unter Gesamtregister → Alle Personen & Kandidaturen erscheinen auch Personen
mit ausschließlich erfolglosen Wahlteilnahmen oder ohne bislang erfasste
Wahlteilnahme. Rechts stehen ihre Kandidaturen und tatsächlich erfassten
Mandatsabschnitte chronologisch. Im Abgeordnetenregister können Super-Admins
zusätzlich alle Wahlteilnahmen der zentral verknüpften Person ausklappen.

Für jede spätere oder frühere Kandidatur dieselbe vorhandene Person wählen.
Beim erstmaligen Erfassen eines späteren Mandats ist dieselbe Person auch über
„Vorhandene Person suchen, auch frühere Kandidierende“ auswählbar. Die bestehende
Mandatszusammenführung verwendet diese ausdrücklich gewählte person_id.

Die Datenbank-Personen-ID ist der gemeinsame Schlüssel. Wahlen, Wahlkreise,
Parteien und tatsächliche Mandatszeiten bleiben eigenständige historische
Datensätze. Kandidatur, Niederlage oder Listennennung erzeugen niemals ein
Mandat. Wiederwahlzählungen bleiben auf die tatsächlich gewählten Mandate
beschränkt; Nachrücken wird nicht als erneute Wahl gezählt.

Es findet kein nachträgliches Zusammenführen bereits abweichend verknüpfter
Personen anhand des Namens statt. Solche Zuordnungen müssen im vorhandenen
Editor ausdrücklich geprüft werden; bestehende Mandats-/Kandidatur-Fremdschlüssel
und automatische Zusammenführungsprüfungen bleiben aktiv.

Alle neuen RPCs sind Super-Admin-beschränkt und laufen unter Invoker-RLS.
Die Personenanlage wird durch den bestehenden Audit-Trigger protokolliert.
Suchseiten sind auf 26 (25 plus Folgeindikator) und jede ausgewählte Karriere
auf höchstens 200 Kandidaturen und 200 Mandatsabschnitte begrenzt. Die Oberfläche
meldet überschrittene Grenzen, statt still eine unvollständige Laufbahn zu zeigen.

## Gemeinsamer Bereich für Kandidaturen, Ergebnisse und Landeslisten

Die Super-Admin-Werkbank bündelt Kandidaturen, Ergebnisse und Landeslisten unter
einem Haupttab mit zwei Unteransichten. Die gemeinsame Legislaturauswahl bleibt
beim Wechsel erhalten. Ältere Perioden zeigen den Hinweis auf Landeslisten ab
Periode 18, ohne stillschweigend auf die aktuelle Periode zu wechseln. Verweise
aus Problemfällen und Ergebniszeilen öffnen weiterhin die konkrete Liste und
den gewünschten Eintrag. „Problemfälle“ steht unmittelbar vor dem abschließenden
„Gesamtregister“; die übrigen Pflege- und Prüfansichten bleiben erhalten.

Die Ergebnistabelle trennt „Wahlkreisplatz“ und „Listenplatz“. Ab Periode 18 liest
`useCandidacyStateListPlaces` ergänzende Plätze ausschließlich für die angezeigten
Kandidierenden und die ausgewählte Periode. Die Zuordnung verwendet die bestätigte
`election_history_connection_people`-Identität und den Listeneintrag derselben
Partei; Namen werden nicht abgeglichen. Personen ohne bestätigte Verbindung erhalten
keinen erfundenen Listenplatz. Die vollständigen importierten Landeslisten sind
weiterhin in der Unteransicht „Landeslisten“ verfügbar.

Die Ergänzung ist rein lesend. Ein bereits in der Kandidatur erfasster Listenplatz
hat Vorrang; Abweichungen zum verknüpften Listeneintrag werden angezeigt. Mehrere
passende Einträge bleiben als mehrdeutig gekennzeichnet. Listenplatz und
Bewerbungsart ändern weder das Wahlergebnis noch den tatsächlichen Mandatseintritt.
Abfragen verwenden Pakete mit höchstens 100 bestätigten Personen-IDs, zeigen Fehler
explizit und überschreiben keine Kandidaturen. Keine zusätzliche Migration nötig.

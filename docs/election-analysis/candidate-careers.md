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

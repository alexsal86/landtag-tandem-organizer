# Landeslisten 2026

Die Nutzerdatei `Landeslisten_BW_2026_mit_Wahlkreisen.xlsx` enthält 339 Listenplätze: Grüne 70, CDU 75, FDP 66, AfD 60, SPD 68. Die Angaben werden dem zentralen Parteienverzeichnis zugeordnet. Die Datei umfasst 296 Direktbewerbungen, 21 Ersatzbewerbungen und 22 reine Landeslistenbewerbungen.

Die vollständig extrahierten Zeilen samt SHA-256 und den in der Arbeitsmappe angegebenen amtlichen Quellen stehen in [state-lists-2026.json](sources/state-lists-2026.json). Namen werden für die Suche aus „Nachname, Vorname“ in „Vorname Nachname“ umgestellt; akademische Titel bleiben in der ursprünglichen Quellenangabe erhalten. Geburtsjahr, Wohnort, Wahlkreisnummer/-name und Bewerbungsart werden getrennt gespeichert. Die Datei wurde als Nutzerdatensatz übernommen; die verlinkten PDFs wurden für diesen Import nicht erneut abgeglichen.

`20261118010000_import_2026_state_lists.sql` setzt die bisherigen Landeslisten-, Geburtstags- und Fraktionsmigrationen voraus. Die 18. Periode muss mit Wahljahr 2026 existieren. Vorhandene Listen und gleiche Platzbelegungen werden ergänzt, manuelle Personenverknüpfungen bleiben bestehen. Widersprüchliche vorhandene Personen/Platzbelegungen führen zum vollständigen Abbruch statt zur Überschreibung. Die Migration legt weder neue Personen noch Mandate oder persönliche Wahlergebnisse an.

Automatische Verknüpfung: Ein normalisierter exakter Name muss über alle Historien genau eine Verbindungskennung ergeben; Partei und vorhandene Geburtsjahre dürfen der Zuordnung nicht widersprechen. Namensgleiche Historien werden nicht anhand der Partei gegeneinander ausgewählt. Offene Fälle bleiben in der bestehenden Problemübersicht sichtbar und können in Landeslisten ausdrücklich zugeordnet werden. Spätere Mandatsimporte/-änderungen und Geburtstagskorrekturen prüfen automatische Zuordnungen erneut.

Die Profildetailseite unter Daten und das Abgeordnetenregister zeigen für die ausgewählte Person ihre verknüpften Listenplätze mit Wahljahr, Partei, Listenplatz und Bewerbungsart. Der ausschließlich lesende RPC liefert nur freigegebene Perioden, auch für Super-Admins. Eine Platzierung oder Ersatzbewerbung beweist keinen Mandatsgewinn.

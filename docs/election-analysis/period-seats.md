# Sitzverteilungen der Legislaturperioden

Die Migration `20261117210000_election_period_seats.sql` ergänzt die Gesamtsitze und eine editierbare Partei-/Fraktionsverteilung für 18 vorhandene Perioden. Sie muss in Supabase angewendet werden, bevor die neue Oberfläche verwendet wird. Periodennummer und Wahljahr müssen übereinstimmen; manuelle Sitzangaben werden nicht ersetzt. Termine, Personen und Mandatsabschnitte werden nicht geändert.

Die Anzeige steht in der Periodenliste und in der Mandats- und Kandidatenanalyse der gewählten freigegebenen Periode. Gesamtsitze werden separat erfasst. Eine unvollständige Parteiverteilung bleibt als solche sichtbar; die Anzahl aller erfassten Mandatsabschnitte einschließlich Nachrückern ist keine Parlamentssitzzahl.

Der Bezugsstand ist die Sitzverteilung nach der Wahl, ohne spätere Fraktionswechsel. Alternativ können Beginn der Periode oder ein ausdrücklich datierter Stichtag erfasst werden. Parteien werden unabhängig vom rechtlichen Fraktionsstatus angezeigt. Fehlende Gesamtzahlen bleiben unbekannt.

Die gelieferten Daten sind in [period-seat-distributions.json](sources/period-seat-distributions.json) dokumentiert. Historische Quelle: [Statistisches Landesamt, Monatsheft 11+12/2025, Tabelle 2, Seite 31](https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf). Die dritte Periode enthält die Wiederholungswahl vom 12.03.1961. Für 2026 gilt das [amtliche Endergebnis vom 27.03.2026](https://www.landtag-bw.de/de/aktuelles/themen/landtagswahl-2026): 157 Sitze (Grüne 56, CDU 56, AfD 35, SPD 10).

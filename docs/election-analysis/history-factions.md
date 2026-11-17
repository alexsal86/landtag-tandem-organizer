# Zentrale Fraktionen und Parteien

Unter **Wahldaten & Mandatshistorie → Fraktionen & Parteien** können Super-Admins Kurzbezeichnung, vollständigen Namen, bekannte Schreibweisen und Auswählbarkeit pflegen. Das Verzeichnis gilt über alle Legislaturperioden hinweg. Parteien ohne rechtlichen Fraktionsstatus gehören ebenfalls hinein.

Mandate (Partei und zusätzliche historische Fraktionszuordnung), Kandidaturen, Landeslisten und Sitzverteilungen verwenden eine Auswahl. CSV-/Excel-Importe lösen bekannte Schreibweisen auf; unbekannte Angaben müssen vor dem Import ausdrücklich einem Verzeichniseintrag zugeordnet werden. Neue Einträge entstehen ausschließlich in der zentralen Verwaltung.

Die Migration `20261117220000_central_history_factions.sql` setzt die Sitzdatenmigration voraus. Sie übernimmt alle vorhandenen Zuordnungen, vereinheitlicht explizite Schreibvarianten (z. B. FDP/FDP-DVP/FDP/DVP) sowie Großschreibung und Leerzeichen und erhält sonstige historische Bezeichnungen als eigenständige Einträge. BHE und GB/BHE bleiben getrennt; parteilos wird nicht mit fraktionslos gleichgesetzt. Eine bereits doppelt angelegte Landesliste derselben Partei und Periode wird wegen der bestehenden Eindeutigkeitsregel nicht automatisch zusammengeführt; ein solcher Konflikt bricht die Migration ohne Teiländerungen ab.

Mandate, Kandidaturen und Landeslisten sind durch Fremdschlüssel an die eindeutige Verzeichnisbezeichnung gebunden. Umbenennungen aktualisieren diese Bezüge und die Sitzverteilungsdaten gemeinsam in derselben Transaktion. Die bisherige Bezeichnung bleibt als Import-Schreibweise erhalten. Datenbank-Trigger schützen auch direkte Schreibzugriffe und automatische Kandidaturübernahmen vor unbekannten Angaben. Bestehende Audit- und Validierungstrigger bleiben aktiv. Personen, Mandatszeiten und Sitzanzahlen werden nicht neu abgeleitet.

Verwendete Einträge werden nicht gelöscht; inaktive Einträge bleiben historisch sichtbar und sind für neue Auswahlen ausgeblendet. Originale Quellen-Snapshots, Audit-Einträge und die unabhängigen amtlichen `election_analysis_*`-Ergebnisdaten behalten ihre ursprünglichen Bezeichnungen und Codes.

Jeder Eintrag behält zusätzlich eine feste Quellenzuordnung (`result_code`). Umbenennungen ändern weder amtliche Ergebnis-Codes noch deren Zuordnung in der automatischen Kandidaturübernahme und im Kandidatenvergleich.

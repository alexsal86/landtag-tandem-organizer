# Erste Ausbaustufe: P0–P3

## Bestehende Architektur

Die bestehenden sechs election_analysis_* Tabellen bleiben die einzige Quelle für
Wahlergebnisse, Beteiligung, Wanderung und Demografie. Die eigenständige
Mandatshistorie bleibt erhalten. Queries werden nach Benutzer/Jahr/Analyse/Partei
begrenzt, Leaflet und Recharts werden wiederverwendet. Zentrale Änderungen bleiben
per RLS auf Super-Admins beschränkt. Keine Testausführung in dieser Sitzung.

## Reihenfolge

1. P0: Amtliche Endergebnisse und Geometrien beschaffen, normalisieren und mit dem
   bestehenden Import vergleichen. Vorschau und erwartete Altwerte schützen
   manuelle Korrekturen. Freigabe eines Datenstands nur nach vollständiger Prüfung.
2. P0: Wahlperioden-ID und explizite Wahlkreisversionen verknüpfen. Ungeprüfte
   historische Identitäten bleiben unbekannt. Periodenquellen und erwartete Enden
   vom tatsächlichen Enddatum unterscheiden.
3. P1: Ein Wahlkreis-Steckbrief lädt nur diesen Wahlkreis, verfügbare Wahljahre,
   gewählte Vergleichsjahre und explizit zugeordnete Mandate. Einstieg über Daten
   und Karte, ohne neue Personen/Kandidaturen aus Namen abzuleiten.
4. P2/P3: Gemeinsame berechenbare Differenzen, Vergleichbarkeit und Datenstand in
   Tabellen und abgestuften Karten. Zahlen nicht unabhängig für Karte/Tabelle
   berechnen. Eindeutige Hinweise zu Wahlsystem und Grenzen.
5. Unit-/Zugriffs-/Selbsttests ergänzen (nicht ausführen), Dokumentation und
   Quellen-/Differenzberichte aktualisieren. P4/P5 bleiben getrennte Folgepakete;
   P6 wird ausschließlich als methodisches Konzept dokumentiert.

## Bekannte Lücken vor Umsetzung

- 2026 im bisherigen Import: Wahlkreise vorläufig, Landeswerte endgültig.
- Wahlkreisnummern über Jahrzehnte sind keine stabilen Identitäten; der Import
  enthält acht widersprüchliche Kombinationen aus Nummer und historischem Namen.
- Personen der Mandatsliste sind teilweise nur Namen, ohne bestätigte Identität.
- Vollständige Kandidaturen, bestätigte historische Grenzen vor 2021 und regionale
  Strukturdaten sind nicht vorhanden. Kein Amtsinhabermodell daraus ableiten.
- Bestehende öffentliche GeoJSON-Datei ist EPSG:31467, kein Leaflet-WGS84.
- Amtliche Originaldownloads benötigen Freigabe der offiziellen Domains; bis zum
  tatsächlich erfolgreichen Download kein Endgültigkeits-/Geometrievermerk.

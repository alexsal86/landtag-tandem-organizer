# Korrekturen am historischen Abgeordnetenimport

Die importierte Arbeitsmappe enthält zwei widersprüchliche Wahlkreisangaben:

- **1956 / 2. Legislaturperiode:** Ludwig Leber wurde mit `05 Stuttgart IV`
  geliefert. Richtig ist **04 Stuttgart IV**. Die Übersicht des Statistischen
  Amts Stuttgart führt ihn für 1956 unter den Zweitmandaten mit `(IV)`:
  [Statistik und Informationsmanagement, Monatsheft 4/2001, Tabelle der gewählten Abgeordneten](https://www.domino1.stuttgart.de/web/komunis/komunissde.nsf/f52fea0bca3e2c09c125723c00493912/67089c96aa428e27c12586f10023d0c3/%24FILE/c4h01_.PDF).
  Auch das [Landtagshandbuch der 3. Wahlperiode, Beilage 4228](https://www.landtag-bw.de/resource/blob/160724/44870fc856765a802871e2424f47b172/03_4228_D.pdf)
  nennt für Leber ausdrücklich Wahlkreis 4, Stuttgart IV (diese zweite Quelle
  bezieht sich auf 1960–1964).
- **1964 / 4. Legislaturperiode:** Alfred Entenmann wurde mit `23 Waiblingen`
  geliefert, Paul Knittel mit `23 Waiblingen I`. Die damalige Nummer 23 heißt
  **Waiblingen I**; Nummer 24 ist Waiblingen II. Maßgeblich ist die bereits
  hinterlegte historische Nummern-/Namensliste in
  `1968-district-names.csv` (für den bestätigten Grenzstand 1964/1968).

Der bisherige Import legte je Namensvariante einen eigenen Datensatz ohne
numerische Zuordnung an. So entstanden zunächst jeweils 71 Datensätze. Die
Geometrie-Migrationen ergänzten anschließend Nummer 05 bzw. 23: jeweils 72
Datensätze, davon zwei ungelöste Importeinträge.

Die Korrekturmigration verknüpft die Mandate mit den bestehenden nummerierten
Wahlkreisen und entfernt ausschließlich die vier bekannten Importartefakte.
Personenidentitäten, Mandatstypen und Mandatszeiträume bleiben unverändert.
Die bestehenden Audit- und Geometrie-Invalidierungstrigger bleiben aktiv;
die Grenzzuordnung der beiden Perioden muss danach erneut bestätigt werden.
Der Import korrigiert die beiden konkreten Quellzeilen vor der Konflikterkennung
und verwendet bereits vorhandene nummerierte Wahlkreise samt IDs wieder.

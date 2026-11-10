# Regel-Editor: vollständiger Funktionsumfang im neuen Layout

Der Editor folgt dem gelieferten Mockup mit vier direkt erreichbaren Schritten,
einer laufenden Zusammenfassung und festen Speichern-/Navigationsschaltflächen.
Er verwendet weiterhin dasselbe Formularmodell und dieselben Speicher- und
Ausführungswege. Eine neue Datenbankmigration ist nicht erforderlich.

## Ergänzungen gegenüber dem Mockup

- Vorlagenauswahl mit den vier Kategorien Mandat & Büro, Personal, Planung, System.
- Zeitgesteuerte Regeln, manueller Start, Datenänderungen und Webhooks inklusive
  Geheimnis und bestehender URL-Anzeige.
- Minutenintervalle, jährliche Stichtage, monatliche und quartalsweise Ausführung,
  Monatsende und Berliner Uhrzeit. Manuelle Jahresroutinen behalten ihren Zeitplan.
- UND/ODER-Gruppen mit sämtlichen Operatoren und bestehenden Verschachtelungsebenen.
  Unbedingte Regeln behalten beim erneuten Öffnen ihre leere Bedingungsgruppe.
- Kombinierbare bestehende Aktionstypen: Benachrichtigung, Push,
  Statusänderung, Aufgabe, E-Mail-Vorlage, Freigabe/4-Augen-Prinzip und Jahresroutine.
  Typabhängige Felder, geschützte Systemroutinen und bestehende Grenzen wie eine Jahresroutine pro Regel bleiben erhalten.
- Büro-/Systemroutinen, Paketabschluss, Kategorien, Zuständigkeiten, Jahresbestätigung
  und bis zu 20 Schritte. Die kompakte Zeitachse zeigt pro Schritt den Vorlauf,
  berechnete Fristen und aufklappbare Zieltypen, Startbedingungen, Verantwortliche,
  Approver sowie Aufgabenvorschläge. Auch das Entfernen eines Abschlusstermins bleibt
  möglich. Sortieren verschiebt die vollständigen Schritte mitsamt Einstellungen.
- Vollständige Routinen-Vorschau und semantische Hinweise zusätzlich zum lokalen
  Bedingungsergebnis. Ohne gültiges JSON-Objekt wird kein Ergebnis behauptet.

## Bedienung und Ausführung

Speichern ist in allen Schritten sichtbar. Fehlende Angaben werden in der
Zusammenfassung verlinkt. Alle vier Schritte sind auch beim Erstellen direkt
anwählbar; die Prüfung vor dem Speichern bleibt bestehen. Ein fehlgeschlagener
Speicherversuch setzt den Editor nicht mehr auf den ersten Schritt zurück.

Ungespeicherte Formularänderungen werden angezeigt. Beim Schließen bzw. Verlassen
der Seite werden sie geschützt; ein Klick auf den Hintergrund schließt den Dialog
nicht versehentlich. Die JSON-Beispieldaten werden nicht als Regelbestandteil
persistiert und zählen deshalb nicht als ungespeicherte Regeländerung.

Die lokale Vorschau wertet UND/ODER-Gruppen einschließlich leerer Gruppen aus.
Der serverseitige Dry-Run verwendet weiterhin eine gespeicherte Regel, erhält
jetzt aber tatsächlich das eingegebene JSON-Objekt statt automatisch erzeugter
Standardwerte. Bei ungespeicherten Änderungen ist dieser Dry-Run gesperrt, damit
kein veralteter Regelstand als aktueller Entwurf erscheint. Lokale Vorschauen
funktionieren auch vor dem ersten Speichern.

Für automatische Jahresroutinen zeigen Zeitachse und Routinen-Vorschau das Jahr
des nächsten automatischen Starts. Ein manueller Sofortstart verwendet weiterhin
das laufende Jahr. Eine Jahresbestätigung gilt nur für das ausgewählte aktuelle
Jahr und wird nicht stillschweigend ins Folgejahr übertragen.

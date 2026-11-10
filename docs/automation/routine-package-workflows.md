# Ablaufgesteuerte Jahresroutinen

## Bereitstellung

Nach der bereits bestehenden Migration `20261110150000_typed_office_routine_steps.sql`
muss für diese Erweiterung zusätzlich `20261110160000_routine_workflow_runtime.sql`
eingespielt werden. Sie legt die Ablaufverfolgung, RPCs, Abschlussprüfung und den
15-minütigen pg_cron-Job an. Die vorhandene Edge Function verwendet weiterhin
denselben `execute_annual_automation_routine`-Endpunkt; ein neues Edge-Deployment
ist dafür nicht notwendig. Ohne die neue Migration verweigert die Oberfläche das
Speichern neuer Schritteinstellungen und zeigt beim Fortschritt einen Ladehinweis.

## Start und Zuständigkeiten

Jeder Schritt übernimmt standardmäßig die Zuständigkeit des Pakets. Optional
werden eine andere aktive Person im selben Büro und eine explizit freigebende
Person ausgewählt. Die gespeicherte Reihenfolge ist absteigend nach Vorlauf;
Sortieren, Hinzufügen und Entfernen verschieben die zugehörigen Typen und
Einstellungen zusammen.

- **Beim Paketstart:** Der Eintrag entsteht sofort mit seiner geplanten Frist.
- **Am geplanten Tag:** Der Eintrag entsteht frühestens an seiner Frist, nach
  Berliner Kalendertag, beim nächsten Prüflauf.
- **Nach vorherigem Schritt:** Der Eintrag entsteht erst, wenn der unmittelbar
  vorherige Schritt abgeschlossen ist. Der erste Schritt kann dies nicht wählen.
- **Nach Freigabe:** Eine separate Entscheidung wird an die ausgewählte Person
  gestellt. Nur deren tatsächliches letztes `yes` startet den Zieleintrag. Eine
  Ablehnung hält den Ablauf an; Rückfragen gelten nicht als Zustimmung.

Entscheidungsschritte gelten nach dem tatsächlichen Ja der zugewiesenen Person
als erledigt. Aufgaben und Teilaufgaben verwenden ihren Erledigungsstatus,
Vorgänge `erledigt` bzw. `archiviert`. Jour-fixe-Schritte erzeugen vorgemerkte
Vorgänge für den bestehenden Agenda-Loader; die Vormerkung allein schließt den
Schritt nicht ab. Abgeschlossene Schritte werden nicht automatisch zurückgedreht,
auch wenn ein Zieleintrag später nachbearbeitet wird.

## Fortschritt und Wiederholung

Jeder Paketstart speichert einen unveränderlichen Ausgangsplan. Automatische
Prüfläufe sowie „Status prüfen und Ablauf fortsetzen“ gleichen offene Ziele ab
und starten freigegebene Schritte. Regelpause und Kill-Switch gelten auch für die
Weiterführung. Überjährige offene Pakete werden separat angezeigt und weiter
verarbeitet. Alle Schritte müssen erledigt sein, bevor die Paketaufgabe geschlossen
werden kann. Zusätzliche manuell angelegte Aufgaben und Teilaufgaben verhindern
einen automatischen Abschluss, solange sie offen sind.

Zielerstellung und Verknüpfung laufen in derselben Schritt-Subtransaktion unter
einer Sperre des Pakets. Fehler rollen diesen einzelnen Schritt zurück. Eine
Wiederholung ist nur für fehlgeschlagene Schritte ohne Zieleintrag erlaubt.
Gelöschte Ziele werden nicht automatisch neu erzeugt; eine Ablehnung wird nicht
übersprungen. Die Paketaufgabe kann während der Ablaufverfolgung nicht gelöscht
werden, damit die jährliche Verknüpfung und Wiederholungssicherheit erhalten bleiben.

Bei einer nicht mehr aktiven zuständigen Person kann die Büroleitung über
„Zuständigkeit ändern“ die Verantwortung im laufenden Schritt und seinem Ziel
korrigieren. Bei einer noch offenen Freigabe kann auch die freigebende Person
ersetzt werden. Deren tatsächliche Zustimmung bleibt erforderlich; frühere
Teilnehmer und Voten werden nicht gelöscht. Diese Änderung betrifft den laufenden
Ablauf, nicht die Vorlage.

## Änderungen an gestarteten Paketen

Speichern im Regel-Editor ändert zunächst nur neue Pakete. „Vorlage auf wartende
Schritte anwenden“ erfordert eine ausdrückliche Bestätigung und übernimmt nur
Schritte ohne Zieleintrag und ohne begonnene Freigabe. Anzahl der Schritte,
Position und Typ gestarteter Einträge sowie der Paketabschluss müssen kompatibel
bleiben; sonst wird die gesamte Übernahme abgelehnt. Änderungen legen beim
Übernehmen noch keine neuen Ziele an. Der nächste Prüflauf kann sie starten.

Vor dieser Migration gestartete Pakete werden nicht nachträglich umgebaut oder
neu erzeugt. Sie behalten ihre vorhandenen Einträge; die Oberfläche kennzeichnet
die fehlende historische Ablaufverfolgung ausdrücklich.

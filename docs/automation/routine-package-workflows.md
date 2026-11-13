# Ablaufgesteuerte Jahresroutinen

## Bereitstellung

Nach der bereits bestehenden Migration `20261110150000_typed_office_routine_steps.sql`
muss für diese Erweiterung zusätzlich `20261110160000_routine_workflow_runtime.sql`
eingespielt werden. Sie legt die Ablaufverfolgung, RPCs, Abschlussprüfung und den
15-minütigen pg_cron-Job an. Die vorhandene Edge Function verwendet weiterhin
denselben `execute_annual_automation_routine`-Endpunkt; ein neues Edge-Deployment
ist dafür nicht notwendig. Ohne die neue Migration verweigert die Oberfläche das
Speichern neuer Schritteinstellungen und zeigt beim Fortschritt einen Ladehinweis.

Für Abwesenheitsvertretung und relative Fristen anschließend
`20261110170000_routine_deputies_relative_deadlines.sql` anwenden. Auch hierfür
ist kein Edge-Deployment erforderlich. Die Oberfläche prüft vor dem Speichern
über `office_routine_step_settings_v2`, dass die Erweiterung bereitsteht.

## Start und Zuständigkeiten

Jeder Schritt übernimmt standardmäßig die Zuständigkeit des Pakets. Optional
werden eine andere aktive Person im selben Büro und eine explizit freigebende
Person ausgewählt. Bei ausschließlich paketbezogenen Fristen bleibt die Reihenfolge
absteigend nach Vorlauf. Sobald relative Fristen verwendet werden, gilt die sichtbare
Reihenfolge; Pfeile verschieben ganze Schritte mitsamt Typ und Einstellungen.

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

## Abwesenheitsvertretung

„Bei Abwesenheit vertreten lassen“ ist je Schritt standardmäßig eingeschaltet.
Die Ausführung nutzt das bestehende Abwesenheitstool: genehmigte, ganztägige
Abwesenheiten und deren `leave_requests.deputy_user_id`. Arzttermine werden
nicht als ganztägige Abwesenheit gewertet. Maßgeblich ist der aktuelle Berliner
Kalendertag. Auch bereits erzeugte offene Ziele und offene Freigaben werden bei
den üblichen Prüfläufen umgestellt; nach Ende der Abwesenheit kehrt ihre
Zuständigkeit zurück. Die ursprüngliche Person bleibt separat gespeichert und
die Oberfläche zeigt eine aktive Vertretung an.

Abwesenheitsketten werden bis zu einer verfügbaren, aktiven Person desselben
Büros verfolgt. Fehlende, widersprüchliche, bürofremde oder zyklische Vertretungen
halten den Schritt mit einem Hinweis an. Nach Korrektur prüft der nächste Lauf
erneut. Die Abwesenheitstabelle hat keine Mandantenspalte; deshalb wird jedes
Glied über aktive Büromitgliedschaften geprüft. Es werden keine Abwesenheitsgründe
in die Ablaufanzeige übernommen.

Abgegebene Ja/Nein-Entscheidungen werden beibehalten und nie automatisch erzeugt.
Ist eine Freigabe erteilt und der Zieleintrag angelegt, bleibt die Freigabeperson
fest. Explizites manuelles Neuzuweisen setzt eine neue Stammzuständigkeit.

## Relative Fristen

Jede Frist kann auf den Paketabschluss, den geplanten Termin oder den tatsächlichen
Abschluss des unmittelbar vorherigen/nächsten Schritts bezogen werden. Bei
geplanten Nachbarterminen sind −365 bis +365 Kalendertage erlaubt; negative Werte
bedeuten davor. Nach tatsächlichem Abschluss sind 0 bis 365 Tage erlaubt. Bis zum
Abschluss des Bezugsschritts bleiben Termin und Zielerstellung offen. Startbedingung
und Frist bleiben getrennte Einstellungen, aber beide müssen erfüllbar sein.

Die Vorschau und Datenbank prüfen dafür einen Abhängigkeitsgraphen mit getrennten
Knoten für geplante Termine und tatsächliche Abschlüsse. Ein Termin vor dem Plan
des nächsten Schritts darf also mit dessen Start nach dem aktuellen Schritt
kombiniert werden; eine gegenseitige Abhängigkeit vom tatsächlichen Abschluss
wird zurückgewiesen. Fristen werden weiterhin auf den Paketstart begrenzt.
Sobald ein Zieleintrag oder eine Freigabe existiert, bleibt dessen Termin fest.

Abschlussereignisse von Aufgaben, Teilaufgaben und Vorgängen werden mit ihrem
Zeitpunkt in einer privaten Tabelle festgehalten, ohne aus Zieltriggern Ablaufzeilen
zu sperren. Bei Entscheidungen zählt der tatsächliche Antwortzeitpunkt. Für schon
vor der Erweiterung abgeschlossene, noch nicht abgeglichene Ziele dienen die
vorhandenen Abschluss-/Änderungszeitpunkte als Rückfall. Damit verschiebt ein
verspäteter Prüflauf den relativen Bezugstag bei neuen Abschlüssen nicht.

## HR-Onboarding und Offboarding

`20261113150000_employee_hr_lifecycle.sql` ergänzt einen zweiten fachlichen Kontext
für dieselben `routine_package_runs` und `routine_package_steps`. Jahrespakete
behalten ihren bisherigen Kontext; HR-Pakete referenzieren eine Beschäftigung in
`employee_lifecycle`. Der vorhandene 15-Minuten-Dispatcher und ausschließlich
`automation_private.advance_routine_package` erstellen und verfolgen die Ziele.
Eine zusätzliche Workflow-Engine entsteht nicht.

Die Lücken des bisherigen Modells waren der zwingende Jahresaufgaben-Bezug,
Fristbegrenzung auf den Planungsbeginn, fehlende Eintritts-/Austrittsanker sowie
Pflicht- und Nachweismetadaten. Für HR speichert jeder Schritt seinen konkreten
Bezugs-Kalendertag beim Start; negative und positive Abstände bleiben dadurch
auch vor dem ersten Arbeitstag korrekt. Alle Fristen zählen Kalendertage.

Unter `/employee?tab=hr` verwaltet die Leitung Beschäftigungsart, Eintritt,
Austritt und Mentor:in. Onboarding und Offboarding werden je Beschäftigung genau
einmal gestartet. Gleichzeitige und wiederholte Starts erzeugen keine neuen
Pakete. Ein erneutes Beschäftigungsverhältnis erhält einen eigenen Datensatz mit
neuem Eintritt. Änderungen an Beschäftigung oder Vorlage ändern laufende
Snapshots nicht. Offboarding bleibt für bereits deaktivierte Tenant-Mitglieder
möglich; Onboarding benötigt eine aktive Mitgliedschaft.

Die Administration bietet unter Automatisierung → HR-Rollenvorlagen denselben
`RoutineStepsEditor`, ergänzt um Phase, Pflichtkennzeichen, Eintritt/Austritt und
Nachweisart. Ziele sind bestehende Teilaufgaben als Checklistenpunkte oder
Aufgaben. Anfangsvorlagen: Praktikum, studentische Hilfskraft, wissenschaftliche
Referent:innen und allgemeines Offboarding. Bei fehlendem Austrittsdatum startet
eine Vorlage mit Austrittsbezug nicht. Optionale Punkte zählen getrennt; der
vorhandene Paketabschluss wartet weiterhin auf sämtliche Schritte.

DSGVO-Verpflichtungen erhalten einen unveränderlichen Nachweis mit Datum,
bestätigender Person und optionalem Dokumentverweis im selben Tenant. Ein
normaler Aufgaben-/Teilaufgaben-Haken kann diesen Nachweis nicht ersetzen.
Leitung bestätigt Nachweise und Offboarding-Übergaben; Mitarbeitende erledigen
ihre gewöhnlichen eigenen Punkte. Zusätzliche restriktive Policies schützen
auch die zugrunde liegenden Aufgaben und Teilaufgaben vor teamweitem Lesen.
Es werden keine Ausweis- oder Schlüsselnummern erhoben.

Da Phase 2 entfällt, ergänzt diese Migration die benötigte minimale
`handover_tasks_to_deputy`-RPC. Sie überträgt offene fachliche Aufgaben atomar an
eine aktive Person desselben Büros, behält `ball_owner` bei und lässt persönliche
HR-Aufgaben aus. Erneute Ausführung überträgt nichts doppelt. Zugänge, Postfach
und Schlüssel werden als menschlich zu bestätigende Arbeitsschritte behandelt;
diese Erweiterung sperrt keine externen Konten automatisch.

Team-Hinweise zeigen überfällige Pflichtpunkte und Austritte in den nächsten
30 Tagen. Leitung kann eine Erinnerung auslösen; der vorhandene Dispatcher
übernimmt dieselbe Prüfung regelmäßig. Pro Beschäftigung, Empfänger:in und
Berliner Kalendertag wird eine Erinnerung beansprucht, bevor Benachrichtigungen
entstehen. Der Tenant-Kill-Switch bleibt wirksam. Der HR-Selbsttest startet die
Vorlage tatsächlich zweimal und prüft den Nachweisschutz; seine gesamten
Fixtures werden durch eine Datenbank-Subtransaktion zurückgerollt.

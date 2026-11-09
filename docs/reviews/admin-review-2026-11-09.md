# Prüfung des Adminbereichs – 9. November 2026

## Umfang und Aussagekraft

Bestandsaufnahme aller **56 sichtbaren Unterpunkte in sieben Menügruppen** anhand von `AdminSidebar.tsx`, `Administration.tsx` und den zugehörigen Komponenten, Hooks und relevanten Migrationen/Edge Functions. Vertiefte Prüfung der unten genannten Fehlerpfade. Vier Fehler wurden mit lokalem PostgreSQL beziehungsweise der tatsächlichen Zeitberechnung nachgestellt. Keine Änderungen an Produktivdaten oder am Anwendungscode während dieser erweiterten Prüfung.

Das ist keine vollständige Live-Abnahme sämtlicher 56 Masken: produktive Datenbankregeln, tatsächlich ausgerollte Migrationen, externe Kalender/Feeds und reale Ladezeiten müssen mit passenden Testkonten zusätzlich geprüft werden. Eine fehlende Auffälligkeit in der Bestandsaufnahme bedeutet keine Freigabe. Die zuvor vorgenommenen Korrekturen bleiben bestehen; die atomare Rollenfunktion benötigt weiterhin ihre Migration.

## Befunde nach Priorität

### A01 – Kritisch: Kalenderdiagnose prüft keine Bürozugehörigkeit

`supabase/functions/ics-validation/index.ts:31–97` authentifiziert den Aufrufer, verwendet anschließend den Service-Schlüssel und liest den per ID angegebenen Kalender samt Terminen. Eine Prüfung der Mitgliedschaft oder Adminrolle für dessen Büro fehlt im Handler. Der gemeinsame Safe-Handler ergänzt Fehlerbehandlung und CORS, keine Büroprüfung. Die Antwort enthält Beispieldaten mit Termintiteln und Zeitpunkten (`:145–159`).

**Auswirkung:** Ein angemeldeter Nutzer mit bekannter Kalender-ID kann über diesen Codepfad Diagnosedaten eines fremden Büros abrufen. Im Admin-Debug-Frontend ist sogar eine feste Kalender-ID hinterlegt. Kein Zugriff auf fremde Live-Daten wurde durchgeführt.

**Abhilfe:** Kalender laden, anschließend aktive Bürozugehörigkeit und erforderliche Rolle erzwingen, bevor Feed oder Termine gelesen werden; Negativtest mit zweitem Büro hinzufügen. ICS-URLs mit möglichen Zugriffstokens nicht protokollieren (`:64`).

### A02 – Kritisch: Standard-Meetingvorlage verändert andere Büros

`supabase/migrations/20251223235926_693127e2-ddfc-4af2-9e39-7a2edbd84e10.sql:5–16`: Der SECURITY-DEFINER-Trigger setzt `is_default=false` bei allen anderen Standardvorlagen. Ein Filter auf `NEW.tenant_id` fehlt. Im Repository wurde keine spätere Korrektur dieser Funktion gefunden.

**Lokal reproduziert:** Unter einer auf Büro A beschränkten Benutzerrolle hebt das Setzen einer Standardvorlage für A die Standardvorlage von B auf. Der Trigger umgeht dabei die gewöhnliche Zeilensicherheit.

**Abhilfe:** Eindeutigkeit pro Büro statt systemweit definieren, Trigger entsprechend einschränken und mit einem partiellen Unique-Index plus Nebenläufigkeitstest absichern.

### A03 – Hoch: Datenbankregeln des Berechtigungseditors verwenden die falsche Identität

`supabase/migrations/20260507210223_b094f441-67b8-4830-9b19-b528912f7103.sql:22–108` vergleicht `profiles.id` mit `auth.uid()`. Laut Profilschema ist `profiles.id` eine eigene zufällige ID; das Auth-Konto steht in `profiles.user_id`. Auch die Hilfsfunktionen verwenden die falsche Zuordnung (`:138`, `:166`, `:193`). Zusätzlich ermitteln sie das Büro aus einem einzelnen Profil statt aus dem aktuellen Vorgang und dessen Mitgliedschaft.

**Lokal mit der tatsächlichen Migration reproduziert:** Ein korrekt angelegter Administrator sieht keine gespeicherten Modulregeln; ein Schreibversuch wird mit `42501` abgelehnt. Die vorherige UI-Korrektur behebt die Anzeige und Speicherung bei Fehlern, nicht diese tiefer liegenden Datenbankregeln.

**Abhilfe:** Mitgliedschaftsbasierte, explizit bürobezogene Policies und Funktionsparameter verwenden. Mit unterschiedlichen Profil-/Auth-IDs und mehreren Büros testen.

### A04 – Hoch: Zahlreiche konfigurierbare Rechte sind noch nicht an die Funktionen angeschlossen

Repositoryweite Suche findet `useFieldPermission`, `useTenantFeatureFlag` und `RequireAction` als Infrastruktur, aber keine konsumierenden Produktkomponenten für diese Gates. `is_action_allowed`, `can_read_field`, `can_write_field` und `is_feature_enabled` werden in der betreffenden Migration definiert, aber im geprüften Repository nicht von den Geschäfts-RPCs/Policies aufgerufen.

**Auswirkung:** Ein gespeicherter Schalter für beispielsweise „Brief versenden“ oder „Kontakt · E-Mail lesen“ ist kein Beleg, dass die Aktion beziehungsweise das Datenfeld tatsächlich gesperrt wird. Bestehende allgemeine Rollen-/Büroschutzregeln bleiben davon getrennt bestehen. Insbesondere gibt es keinen Nachweis, dass ein Feldverbot bereits serverseitigen Datenschutz erzwingt.

**Abhilfe:** Für jede angebotene Regel einen tatsächlichen Durchsetzungspunkt benennen und testen. Feldschutz braucht geschützte Lese-/Schreibschnittstellen; das bloße Verbergen eines UI-Feldes genügt nicht. Bis zur Integration unvollständige Optionen kenntlich machen oder ausblenden.

### A05 – Hoch: E-Mail-Vorlagen folgen teilweise dem falschen Büro

- `NewsEmailTemplateManager.tsx:45–58,83–112`: Wählt die erste aktive Mitgliedschaft per `limit(1)` statt `currentTenant`; lädt nur beim Mounten. Mehrbüro-Nutzer können trotz ausgewähltem Büro B die Vorlage von A bearbeiten.
- `src/components/task-decisions/DecisionEmailTemplates.tsx:30–74`: Lädt ohne Bürofilter per `maybeSingle()`, erzeugt Standardvorlagen anhand des Profilbüros. Mehrere sichtbare Vorlagen können einen Mehrzeilenfehler auslösen; Bürowechsel aktualisiert die Maske nicht.
- `EventEmailTemplateManager.tsx:94–105`: Vermischt beim Laden neue Daten mit dem bisherigen Formularzustand. Fehlt im neuen Büro eine Vorlage, bleibt die alte sichtbar und kann unter dem neuen Büro gespeichert werden.

**Abhilfe:** Aktuelles Büro einheitlich verwenden; Formular, IDs und Entwürfe beim Bürowechsel zurücksetzen; verspätete Antworten verwerfen. Zwei-Büro-Test mit bewusst fehlender Vorlage durchführen.

### A06 – Hoch: Kalenderzeiten werden falsch ausgewertet; Debug ist auf einen Kalender festgelegt

`auto-sync-calendars/index.ts:46–57` liest `syncMinute`, verwendet es aber nicht. Stattdessen läuft die Prüfung stets in den ersten fünf Minuten der passenden Stunde.

**Mit tatsächlichem Berechnungscode reproduziert:** Konfiguriert 06:30 → bei 06:00 fällig, bei 06:30 nicht fällig. Eine explizite Bürozeitzone, Sommerzeitbehandlung und ein persistierter Fälligkeits-/Claim-Mechanismus sind in diesem Pfad nicht erkennbar.

`src/features/calendar/components/CalendarSyncDebug.tsx:51–78` nutzt eine fest codierte Kalender-ID; der Neuaufbau sendet `clear_existing:true`. Der Force-Resync-Handler besitzt eigene Rechteprüfungen, die Diagnosefunktion dagegen nicht (A01).

**Abhilfe:** Nächste Ausführung mit Minuten und festgelegter Zeitzone berechnen; Wiederholungen und verpasste Cron-Läufe berücksichtigen. Debug-Kalender aus dem aktuellen Büro auswählen lassen, Löschumfang vor dem Neuaufbau anzeigen.

### A07 – Hoch: Sortieren von Kategorien/Status kann an Pflichtfeldern scheitern

`ConfigurableTypeSettings.tsx:108–125` sendet beim Sortieren nur `{id,order_index}` als Upsert. Die Konfigurationstabellen besitzen jedoch Pflichtfelder wie `name` und `label` ohne Default. PostgreSQL prüft diese vor der Konfliktauflösung.

**Lokal reproduziert:** Der entsprechende Upsert gegen das tatsächliche `task_categories`-Schema scheitert mit `23502`, obwohl die ID bereits existiert. Betrifft den gemeinsamen Editor für Termin-, Aufgaben-, ToDo-, Dokumenten- und Fallaktenkonfigurationen je nach Tabellenschema.

**Abhilfe:** Atomare, bürogeprüfte Sortierfunktion oder echte Updates verwenden; nicht einen unvollständigen Insert-Payload als Update-Ersatz senden.

### A08 – Hoch: Meeting-/Planungsvorlagen und Statusauswahl reagieren nicht sauber auf Bürowechsel

`MeetingTemplateManager.tsx:41–64` lädt einmal ohne Filter auf das ausgewählte Büro. Die sichtbaren Daten können nach RLS aus mehreren zugänglichen Büros stammen. Neue Meetingvorlagen enthalten keine `tenant_id`; die vorhandene Insert-Policy verlangt eine zulässige `tenant_id`. Ohne zusätzliche Live-Regeln ist das Anlegen damit nicht konsistent mit dem Schema.

`PlanningTemplateManager.tsx:119–128` und `StatusAdminSettings.tsx:45–55` laden ebenfalls nur beim Mounten und ohne aktuellen Bürofilter. Daraus allein folgt keine Freigabe fremder Daten: RLS kann begrenzen, löst aber nicht die Auswahl des aktuellen Büros.

**Abhilfe:** Büro explizit lesen/schreiben und als Ladeabhängigkeit verwenden; Auswahl und Editorzustand zurücksetzen. Vorlagenanlage mit realen RLS-Regeln testen.

### A09 – Mittel: Audit-Suche liefert unvollständige Ergebnisse

`AuditLogViewer.tsx:29–59` paginiert zuerst auf 50 Einträge und durchsucht anschließend ausschließlich diese Seite im Browser. Suche und IP-Filter setzen den Seitenoffset nicht zurück; jeder Tastendruck verändert den Query-Key und löst eine neue Serverabfrage aus. Der CSV-Export exportiert nur die aktuell geladene, gefilterte Seite.

**Auswirkung:** Ein existierender Treffer auf einer anderen Seite kann als nicht vorhanden erscheinen; Gesamtzahl und Suchergebnis passen nicht zusammen.

**Abhilfe:** Serverseitig vor der Pagination suchen, Eingabe verzögern, Offset bei Filterwechsel zurücksetzen. „Aktuelle Seite exportieren“ und vollständigen Export getrennt anbieten.

### A10 – Mittel: Sicherheits- und Performanceanzeigen verwechseln Fehler mit leeren Ergebnissen

`SecurityCockpit.tsx` und `PerformanceDashboard.tsx` werfen Queryfehler, stellen aber keinen entsprechenden Fehlerzustand dar. Fehlende Daten werden in Summen zu null beziehungsweise in Leerzustände umgewandelt. Das Performance-Dashboard kann „Keine Anomalien — alles im grünen Bereich“ anzeigen, obwohl die Abfrage fehlgeschlagen ist (`:313`). Ähnliche Muster bestehen unter anderem im DSGVO-Viewer und bei der Urlaubscheckliste.

**Abhilfe:** „Prüfung fehlgeschlagen“, „noch nicht geprüft“, „keine Daten“ und „keine Probleme gefunden“ unterscheiden. Letzte erfolgreiche Prüfung und Datenstand anzeigen; Retry anbieten.

### A11 – Mittel: Sammelspeicherungen melden Erfolg trotz Teilfehlern

- RSS-Reihenfolge (`RSSSourceManager.tsx:184–191`) führt N einzelne Updates nacheinander aus und wertet deren `error` nicht aus.
- Automatische Benutzerfarben (`UserColorManager.tsx:114–124`) ebenso.
- Budgetfortschreibung (`src/components/expenses/hooks/useExpenseData.ts:117–129`) prüft den Fehler des Inserts für die Folgemonate nicht. Das erste Upsert besitzt außerdem keinen expliziten fachlichen Konfliktschlüssel; wiederholtes Budgetsetzen sollte gegen den tatsächlichen Unique-Constraint geprüft werden.

**Abhilfe:** Atomare Sammelfunktionen, passende Konfliktschlüssel und geprüfte Rückgaben. Teilerfolg präzise ausweisen, wenn eine Transaktion fachlich nicht möglich ist.

### A12 – Mittel: Race Conditions und alte Formulare sind ein wiederkehrendes Muster

Beispiele: `GeneralSettings.tsx`, `CalendarSyncSettings.tsx`, `LoginCustomization.tsx`, `DecisionArchiveSettings.tsx`, `StakeholderNetworkTagSettings.tsx` und die Vorlageneditoren. Nicht überall werden Ladezustand/Defaults beim Bürowechsel erneuert, alte Entwürfe verworfen oder verspätete Antworten abgefangen. Beim Wechsel auf ein Büro ohne Datensatz bleiben teilweise die Werte des alten Büros erhalten.

**Abhilfe:** Wiederverwendbarer Lade-/Mutationsstandard mit Büro-Key, Fehlerzustand und Entwurfsversion. Ungespeicherte Änderungen vor Wechseln sichtbar machen; Schreibhandlungen nur nach erfolgreichem Laden erlauben.

### A13 – Mittel: Mandantenübersicht skaliert schlecht und kann Nutzer auslassen

Jede `TenantHealthBadges`-Instanz ruft separat eine Edge Function auf. `getTenantHealth` führt je Büro sieben Zählabfragen aus, davon sechs in einer seriellen Schleife (`tenant-seed.ts:324–359`). Damit entstehen bei N Büros N Funktionsaufrufe und etwa 7N DB-Abfragen. Fehler der Zählabfragen werden teilweise als null/0 gewertet.

`manage-tenant-user/index.ts:153` ruft `auth.admin.listUsers()` ohne Paging auf. Die Verwaltung lädt dadurch nicht nachweisbar alle Seiten; große Nutzerbestände können unvollständig bleiben. Zusätzlich werden alle Profile/Mitgliedschaften geladen und wiederholt per `find/filter` durchsucht.

**Abhilfe:** Bürogesundheit gesammelt aggregieren und cachen; Nutzer serverseitig suchen/paginieren; vollständige Auth-Pagination für Exporte; Maps statt wiederholter Vollsuchen verwenden.

### A14 – Mittel: Duplikatsuche verursacht unnötige und möglicherweise überholte Abfragen

`DuplicateScanDashboard.tsx:30–49,72–74`: Jede Slideränderung ändert die Scan-Funktion und löst über `useEffect` eine neue Trigramm-Abfrage aus. Antworten werden nicht nach Aktualität sortiert/verworfen. Der Wert ist auf 200 Paare begrenzt; ohne Kennzeichnung wirkt dies vollständig.

**Abhilfe:** Scan bei Loslassen des Sliders oder mit Debounce starten, veraltete Ergebnisse ignorieren, Ergebnislimit anzeigen und bei Bedarf paginieren.

### A15 – Mittel/niedrig: Nicht alle angebotenen Unterfunktionen sind fertig oder eindeutig

- Sammelaktionen-Audit: Undo-Schaltfläche dauerhaft deaktiviert mit „kommt“; Beschreibung nennt 30 Tage, die Query filtert aber nur nach Büro und begrenzt auf 200 (`BulkActionAuditViewer.tsx:33–40,65,94`).
- Login-Anpassung: `social_login_enabled` und `password_reset_enabled` werden gespeichert, haben im geprüften Login-Frontend keine konsumierenden Prüfungen. Die Login-Auswahl selbst lädt ohne Büroauflösung `limit(1)` (`useLoginCustomization.tsx:60–64`). Nicht mit einer serverseitigen Sperre gleichsetzen.
- Matrix-Einstellungen und Erfolgsanimationen sind nutzerbezogen (`MatrixSettings.tsx`, `useCelebrationSettings.ts`), stehen aber zwischen Büro-/Systemeinstellungen.
- Jährliche Aufgaben: Sidebar zählt Büroaufgaben plus Systemaufgaben (`Administration.tsx`); die Liste lädt nur `tenant_id=currentTenant` (`AnnualTasksView.tsx:169–174`). Abhängig von den vorhandenen Systemdatensätzen können Badge und Liste auseinanderlaufen.
- RSS-Feed-Test ruft fremde URLs direkt im Browser auf (`RSSSourceManager.tsx:203`); ein funktionierender Feed kann wegen CORS als fehlerhaft erscheinen. Ein dedizierter begrenzter Feed-Tester wäre zuverlässiger.

## Performance: gemessener Build-Befund

Aus dem zuletzt erfolgreich erzeugten Produktionsbuild; statische Imports rekursiv ausgewertet, dynamische Imports nicht eingerechnet. Es handelt sich um Codeumfang, nicht um eine gemessene Browser-Ladezeit oder eine Produktionslatenz.

| Messgröße | Ergebnis |
|---|---:|
| Admin-Chunk allein | ca. 618 KiB, gzip ca. 151 KiB |
| Zusätzlicher statisch erreichbarer Admin-JavaScript-Graph gegenüber dem statischen Haupt-Entry | 177 Dateien, ca. 14.180 KiB roh / 4.669 KiB gzip |
| Größter zusätzlicher Chunk: Matrix | ca. 10.145 KiB roh |
| Zusätzlich unter anderem | Gesamtes Lucide-Register, Karten, Charts, Lexical, Selbsttests, Drag-and-drop |

Ein Teil kann bei der Navigation bereits im Cache liegen oder zuvor dynamisch geladen worden sein. CSS/WASM und andere Laufzeitressourcen wurden nicht in diese Zahlen aufgenommen. Übertragungsgröße hängt außerdem von der eingesetzten Kompression ab.

**Größter Hebel:** Unterpunkte in `Administration.tsx` erst beim Öffnen mit `lazy()`/`Suspense` laden. Insbesondere Matrix, Karten-/Geoimporte, Vorlageneditoren, Diagramme und Selbsttest-Center voneinander trennen. Die allgemeine Einstellungsseite braucht diese Bibliotheken nicht sofort. Dynamische Iconauswahl (`src/utils/iconUtils.ts`) importiert das komplette Iconregister; auf ein begrenztes Register umstellen.

**Weitere Hebel:** Health-Abfragen bündeln (A13), Suche/Slider entlasten (A09/A14), RSS/Farb-Sammelupdates bündeln (A11), paginierte Daten statt pauschaler Vollabfragen, gemeinsame Cache-Invalidierung nach Änderungen. Derzeitige „Performance“-Seite misst primär DB-Größe und Wachstum; echte Nutzerperformance benötigt zusätzlich Ladezeit pro Unterpunkt, langsame RPCs und Funktionsfehler/-laufzeiten.

## Bestandsaufnahme sämtlicher Unterpunkte

„Kein zusätzlicher spezifischer Befund“ ist keine vollständige Funktions- oder Sicherheitsfreigabe. Gemeinsame Themen wie Ladefehler, Bürowechsel, Formulardatenverlust, Barrierefreiheit und fehlende Ende-zu-Ende-Tests gelten weiterhin.

| Gruppe | Unterpunkt | Einschätzung / nächster Schritt |
|---|---|---|
| System & Sicherheit | Allgemein | A12; kompletter Seitenreload nach Speichern vermeiden, Logo-Uploads bereinigen |
| | Verwaltung / Kostenmanagement | A11; Bezeichnung in „Kosten & Budget“ ändern; Finanzaktionen separat testen |
| | Audit-Logs | A09; Suchumfang und Export korrigieren |
| | Berechtigungen | A03/A04; Durchsetzung zuerst vervollständigen |
| | Security-Cockpit | A10; Fehler dürfen nicht wie ein sauberer Befund aussehen |
| | DSGVO-Anfragen | Vier-Augen-RPC/Claim-Verfahren ist die richtige Grundlage; Ladefehler und Verarbeitungsstatus besser darstellen; echter Export-/Löschlauf nicht ausgeführt |
| | Performance | A10; Messumfang um Frontend/RPC-Latenzen erweitern |
| | Selbsttest | Neue Rollenregeln abgedeckt; vorhandener Coverage-Check meldet unter anderem nicht eingeordnete `appointment_preparation_history`; keine umfassende Abdeckung aller Adminmasken |
| Benutzer & Kommunikation | Status | A08; Ladefilter und Aktualisierung beim Bürowechsel fehlen |
| | Benutzerfarben | A11; Sammelzuweisung atomar machen |
| | Matrix-Chat | Nutzerbezogene Konfiguration; unter persönliche Integration verschieben; schweres SDK nachladen |
| | Büro-Social-Media | Büro-Key und Upsert vorhanden; URL-Validierung, Entwurfsschutz und Ladefehlerzustand ergänzen |
| | Urlaubs-Checkliste | Ladefehler werden wie leere Liste behandelt; Schreibsperren während Mutationen ergänzen |
| | Büro-Onboarding | Bürofilter vorhanden; Bearbeitungsentwurf bei Bürowechsel zurücksetzen; Mutation-/Sortierfehler gezielt testen |
| Kalender & Termine | Kategorien & Status & Orte | A07; gemeinsamer Editor, Sortierung prüfen |
| | Standard-Gäste | Bürofilter und E-Mail-Prüfung vorhanden; Entwurfswechsel, doppelte Gäste und konkurrierende Aktionen testen |
| | Vorbereitung | Bürofilter vorhanden; Dialogzustand bei Bürowechsel und Eindeutigkeit von Standardvorlagen testen |
| | Synchronisation | A06/A12; Minuten, Zeitzone und sichere Defaults |
| | Debug | A01/A06; fremde Kalenderdaten schützen, feste ID entfernen |
| Inhalte & Daten | Themen | Gemeinsamer Themen-Hook statt eigener Regeln ist gut; Änderungscaches und Konfliktfälle prüfen |
| | Aufgaben-Kategorien/-Status | A07; zudem globale gegenüber bürobezogenen Typen klar kennzeichnen |
| | ToDo-Kategorien | A07; Geltungsbereich ausdrücklich ausweisen |
| | Entscheidungen / E-Mail-Vorlage | A05; aktuellen Büro-Key verwenden |
| | Archivierung | Nutzer- und bürobezogene Einstellung; A12 und Zahlenvalidierung; Geltungsbereich sichtbar machen |
| | Dokumenttypen | A07; verwendete Typen besser deaktivieren statt unbemerkt löschen |
| | Fallakten-Typen/Bearbeitungsstatus | A07; Auswirkungen bestehender Referenzen vor Änderungen anzeigen |
| | Datenqualität | Limit 500, zusätzlich nur 50 pro angezeigter Gruppe; keine unbegrenzte Gesamtauskunft; Fehler-/Leerdatenzustand unterscheiden |
| | Duplikate | A14; Last, Reihenfolge der Antworten und Ergebnislimit verbessern |
| | Sammelaktionen-Audit | A15; Undo als unfertig kennzeichnen oder fertigstellen, Zeitraum korrigieren |
| | Stakeholder-Netzwerk | JSON-Validierung vorhanden; A12 bei fehlendem Datensatz nach Bürowechsel |
| Vorlagen | Briefvorlagen | Schweren Editor nachladen; parallele Bearbeitung/Entwurfsverlust und Referenzen gesondert testen |
| | Brief-Anlässe | Automatisches Seeding schreibt bereits beim Öffnen; explizite, idempotente Initialisierung bevorzugen |
| | Pressevorlagen | Gesamte Sammlung wird als JSON gespeichert; konkurrierende Änderungen können sich überschreiben; Versionierung/optimistische Sperre |
| | Presse-Anlässe | JSON-Sammlung und automatisches Seeding; gleiche Konflikt-/Initialisierungsfragen |
| | Meeting-Templates | A02/A08; Bürogrenzen und Anlegen zuerst korrigieren |
| | Planungs-Templates | A08; Bürozuordnung statt einmaligem ungefiltertem Laden klären |
| | E-Mail-Vorlagen / News | A05; erste Mitgliedschaft ist nicht das ausgewählte Büro |
| | Veranstaltungs-Mails | A05/A12; Defaults beim Bürowechsel vollständig neu aufbauen |
| | Erfolgsanimation | Nutzerbezogene Einstellung; in persönliche Darstellung verschieben |
| Automatisierung | Regel-Builder | Bürobezogene Query-Keys, Mutationen und Historie sind gute Grundlage; vorhandene Typfehler, Importvalidierung, Retry-/Idempotenzfälle bearbeiten |
| | Workflow-Engine 2.0 | Parallel zum Regel-Builder zweites Daten-/Ausführungsmodell; Zweck und unterstützte Trigger klar abgrenzen; Fehler der Run-Historie sichtbar machen |
| | RSS-Quellen | A11/A15; Sortieren, Feed-Test und Saves absichern |
| | RSS-Einstellungen | Bürofilter und validiertes Formular vorhanden; Lade-/Bürowechsel und tatsächliche Nutzung der Limits prüfen |
| | Jährliche Aufgaben | A15; Badge und Liste auf dieselbe Datengrundlage bringen; Ausführungen/Abschlussstatus klar unterscheiden |
| Super-Admin | Tenants | A13; Sammelstatus, Paging, sichtbarer Fehlerstatus |
| | Push-System Tests | Als Diagnostik sinnvoll; echten Empfänger/Umfang kenntlich machen; keine Testbenachrichtigungen versendet |
| | Rechte & Rollen | Vorherige atomare Ersetzung vorbereitet; globale Rolle verändert bewusst keine Büromitgliedschaft; Abhängigkeiten transparent erklären |
| | Kreisverbände | Globale Stammdaten klar kennzeichnen; tatsächliche Rollenmatrix gesondert testen |
| | Betreuungswahlkreise | Globale Zuordnung; Fehlermeldung statt leerer Liste, Mutationsstatus und Rücknahme prüfen |
| | Wahlkreis-Zuordnung | Geltungsbereich global kennzeichnen; Änderungen nachvollziehbar protokollieren |
| | Geo-Datenimport | Nachladen, Vorabprüfung und Fortschritt; keine Importe im Live-System ausgeführt |
| | Karten-Layer | Bürobezogene Query-Keys und Cache-Invalidierung vorhanden; Fehlerstatus und offener Dialog nach Bürowechsel prüfen |
| | Login-Anpassung | A12/A15; Auswahl des Designs vor Login ist nicht sauber bürobezogen; teils wirkungslose Optionen |
| | Meine Arbeit Übersicht | Technische Dokumentation; von produktiven Büroeinstellungen trennen und Diagrammcode nachladen |
| | Dashboard-Hinweise | Formularvalidierung vorhanden; Wirkung/Geltungsbereich, Entwurfswechsel und Konflikte prüfen |
| | Motivationssprüche | Einstellungsverwaltung vorhanden; Geltungsbereich und Konfliktschutz prüfen; eher Darstellung/Inhalte als Plattformtechnik |

## Vorschlag für die Menüstruktur

Die fachlichen Gruppen sind überwiegend verständlich. Drei Ebenen werden jedoch vermischt: **persönliche Einstellungen**, **aktuelles Büro** und **gesamte Plattform**. Jede Maske sollte sichtbar ihren Geltungsbereich nennen; der aktuelle Büroname sollte während der Bearbeitung stets erkennbar sein.

- Persönlich: Matrix-Verbindung, Erfolgsanimationen, persönliche Archivierungsregeln.
- Büro: Team & Rechte, Kalender, Vorlagen, Inhalte/Stammdaten, Automatisierung, Kosten & Budget.
- Plattform: Mandanten, globale Stammdaten, Sicherheit/Datenschutz, Betrieb & Diagnostik.

„Verwaltung“ unter „System & Sicherheit“ konkret in „Kosten & Budget“ umbenennen und fachlich verschieben. E-Mail-Vorlagen unter Vorlagen bündeln; Archivierungsregeln dort platzieren, wo ihr tatsächlicher Geltungsbereich verständlich ist. „Regel-Builder“ und „Workflow-Engine 2.0“ fachlich erklären, langfristig möglichst auf ein Modell konsolidieren. Technische Debug-/Push-/Schemaansichten als Diagnostik zusammenfassen.

56 Unterpunkte brauchen zusätzlich eine Suche, direkte Links, Favoriten/zuletzt verwendete Seiten und eine klare Überschrift mit Brotkrumen im Inhaltsbereich. Für lange Formularseiten sind ein Änderungsindikator, Zurücksetzen und Schutz ungespeicherter Entwürfe nützlicher als weitere Tabs.

## Prüfungen und empfohlene Reihenfolge

Erneut bestanden: 21 gezielte Komponenten-/Logiktests aus der vorherigen Korrektur. Vier zusätzliche Fehlernachstellungen in isolierter PostgreSQL/JavaScript-Umgebung bestanden als Reproduktion der Fehler A02, A03, A06 und A07. Letzter Produktionsbuild erfolgreich; statische Abhängigkeitsanalyse wie oben. Der übergreifende Typecheck ist wegen bestehender Probleme anderer Admin-/Hook-Dateien nicht grün; der vorhandene Selbsttest-Coverage-Check ist ebenfalls nicht vollständig grün. Die 21 Tests sind keine Abnahme aller 56 Unterpunkte.

1. **Bürogrenzen und Rechte:** A01–A04, Standardvorlagen-Trigger und vorhandene Rollen-Migration zusammen prüfen und ausrollen.
2. **Falsche oder verlorene Daten vermeiden:** A05–A08, A11/A12; gemeinsame Mehrbüro-Tests einführen.
3. **Bedienbarkeit und Performance:** Unterpunkte nachladen, A09/A10/A13/A14, unvollständige Unterfunktionen kennzeichnen.
4. **Menü aufräumen und Betrieb absichern:** Geltungsbereiche, eindeutige Labels, echte Performancekennzahlen, Audit-Export und gezielte Ende-zu-Ende-Tests.

# Wissen vereinfachen – Phase A

Stand: 10. November 2026. Untersucht: lokaler Checkout von `alexsal86/landtag-tandem-organizer`, Branch `work`, Commit `842ad6e37`.

Status: Analyse und Vorschlag zur Freigabe. Keine Implementierung, keine Datenbankänderung, keine Datenkonvertierung.

## 1. Ergebnis und Umfang

Empfehlung: Eine neue Frage-Antwort-Oberfläche unter `/wissen` ergänzen. Pro Frage gibt es genau eine gemeinsam bearbeitbare Antwort. Vorhandene Dossiers, Artikel, Fakten, Einträge und ihre Verknüpfungen bleiben in den bestehenden Tabellen und Ansichten erhalten.

Die erste Version benötigt weder Kategorien noch Themen, Tags, Prioritäten, Diskussionen oder Freigaben. Im neuen Bereich werden keine KI-Dienste, Sprachmodelle, Embeddings, automatischen Zusammenfassungen oder semantischen Suchdienste eingebunden. Bestehende, fachfremde KI-Funktionen des Gesamtprojekts sind kein Bestandteil dieses Vorhabens.

Die Untersuchung ist eine Quellcode- und Migrationsanalyse. Der tatsächlich ausgerollte Supabase-Katalog, produktive Datenbestände, Bucket-Einstellungen und wirksame Policies wurden nicht live geprüft. Die Migrationen enthalten historische Widersprüche; sie sind kein Beleg für einen fehlerfrei reproduzierbaren oder identischen Produktivstand. Vor Phase-B-Migrationen muss der Zielstand dagegen abgeglichen werden.

## 2. Bestand

| Bereich | Implementierung und Daten | Bewertung |
| --- | --- | --- |
| Einstieg | `src/components/navigation/navigationConfig.ts`: „Akten → Wissen“ verwendet die ID `dossiers`. `src/components/navigation/AppNavigation.tsx` bietet `/dossiers` als Schnellzugriff an. | Der sichtbare Name ist bereits „Wissen“, führt aber zur komplexen Oberfläche. Beide Stellen ändern. |
| Dossier-Arbeitsbereich | `src/features/dossiers/components/DossiersMainView.tsx`, `DossiersSidePanel.tsx`: Eingang, Mein Radar, Dossiers, Artikel, Fakten; zusätzliche Erfassung, Suche und Dossierbaum. | Als Bestandsoberfläche erhalten, aus dem primären Einstieg nehmen. |
| Dossier-Daten | `dossiers`, `dossier_entries`, `dossier_links`; zusätzliche Hooks für Stakeholder, Positionsversionen, Talking Points, Wiedervorlagen und Quellenbeobachtung. `dossier_entries.dossier_id IS NULL` bezeichnet den Eingang. | Nicht als Frage-Antwort-Modell umdeuten. Fachliche Beziehungen erhalten. |
| Artikel | `src/features/knowledge/components/KnowledgeBaseView.tsx`, `src/components/knowledge/hooks/useKnowledgeData.ts`: `knowledge_documents`, Themenzuordnung, Veröffentlichung, Sperre, Lexical-Inhalte. | Kein Frage-Antwort-Ablauf. Als Artikelansicht erhalten. |
| Versionen und Artikelrechte | `knowledge_document_versions`, daneben Snapshots/Kollaborationsdaten und `knowledge_document_permissions`; `can_access_knowledge_document` und `can_edit_knowledge_document`. | UI-Muster und Textvergleich nutzbar; Datenzugriff und Rechte nicht unverändert übernehmen. |
| Fakten | `src/features/facts/`: `facts` mit Quelle, Tags, Dossier-/Kontaktbezug, Gültigkeit, Archivierung und Nutzungszähler. Picker und Übernahmefunktionen werden auch außerhalb des Wissensbereichs verwendet. | Vollständig erhalten, keine automatische Umwandlung. |
| Suche | Artikel: lokal über bereits geladene Titel/Inhalte. Einträge und Fakten: `ILIKE`-Abfragen. `useGlobalEntrySearch` hat trotz Kommentar keine PostgreSQL-Volltextsuche, keine Titelgewichtung und keinen Debounce. | Neue FTS-Abfrage erforderlich. In den untersuchten Quellen keine vorhandene `tsvector`-/Ranking-Lösung gefunden. |
| Dateien | Dossier-Erfassung lädt in `documents`; Artikel legen zusätzlich `documents`-Datensätze mit `knowledge:<id>`-Tags an. `DecisionFileUpload` wird für Artikelauswahl im Erstellmodus verwendet. | Supabase Storage und Auswahl-/Downloadmuster verwenden; bestehende Bucket-Rechte nicht übernehmen. |
| Routing | `src/pages/Index.tsx`: `/knowledge` öffnet Artikel, `/dossiers` den Dossierbereich, `/wissen` ebenfalls Dossiers, `/wissen/fakten` die Faktenbibliothek. | Neue Oberfläche nur gezielt an `/wissen` einsetzen. Bestehende Einzel- und Faktenlinks erhalten. |

Wichtige Migrationen: `20260325224919_cfb1734e-455f-4014-bc2b-713f7216da90.sql` für Dossiers, Einträge und Links; `20260325232810_a48442b6-ed2a-467f-92d1-2878b064912e.sql` für Dossier-Prüftermine; `20260309035059_31d46183-ddf5-4d57-850d-3712de3b562e.sql` für Artikelversionen; `20260507105435_6bf53ac7-344f-490a-abd9-57e90b949fcc.sql` für Fakten.

### Sicherheits- und Integrationsbefunde

1. **Öffentlicher gemeinsamer Dateibucket:** `20260407155349_3f4f564a-2f5c-450a-a1a6-288e06ac2647.sql` setzt `documents.public = true`. Der Editor-Bildupload nutzt diesen Bucket und `getPublicUrl`. Ein Mandantenpräfix im Dateinamen schützt öffentliche Dateien nicht. Neue Wissensanhänge benötigen privaten Storage. Eine pauschale Umstellung des gemeinsamen Buckets würde weitere Verbraucher betreffen, beispielsweise Pressebilder, Redaktionsplanung und Belege.
2. **Mandantenwahl im alten Artikel-Hook:** `useKnowledgeData` ermittelt den primären Mandanten per RPC statt `useTenant().currentTenant`. Die Artikelabfrage enthält keinen expliziten Filter auf den ausgewählten Mandanten. Das ersetzt keine RLS-Prüfung und eignet sich nicht als Vorlage für den neuen Bereich.
3. **Unterschiedliche Identitäten:** Dossiers verwenden Fremdschlüssel auf `profiles.id`; Artikel arbeiten mit Auth-Benutzer-IDs. `useCurrentProfileId` dokumentiert diesen Unterschied. Neue Actor-Felder sollen einheitlich Auth-Benutzer-IDs verwenden; Namen werden über mandantenbezogene Profile geladen. Zuordnungen werden serverseitig gegen aktive Mitgliedschaften geprüft.
4. **Historische Artikelrechte:** Die Helper-Definition vom 13. August 2025 prüft Veröffentlichung/Einzelrechte ohne Mandantenbedingung; nachfolgende Migrationen löschen Helper, spätere referenzieren sie wieder. Zusätzlich stehen in der Historie mehrere unterschiedlich benannte SELECT-Policies mit unterschiedlicher Reichweite. Zulassende PostgreSQL-Policies werden üblicherweise mit ODER kombiniert. Der ausgerollte Stand muss vor einer Wiederverwendung geprüft werden, insbesondere auch bei Versionen und Snapshots.
5. **Neue Daten brauchen stärkere Integritätsregeln:** Die untersuchten Dossier-/Fakten-Policies prüfen überwiegend aktive Mitgliedschaft. Daraus folgt noch keine Absicherung gegen fremde Verantwortliche, fingierte Bearbeiter, Änderungen der Bürozuordnung oder mandantenfremde Beziehungen. Diese Regeln im neuen Modell ausdrücklich in der Datenbank erzwingen.
6. **Vorhandene Rechtestruktur:** `useAuth`, `useTenant`, `useTenantProfiles`, `useActionPermission`, `action_permissions` und `is_tenant_action_allowed` sind vorhanden. `module.knowledge` ist ein vorhandenes Feature-Flag, kein Ersatz für Datenrechte. Die Aktionsfunktion kann Plattformadministratoren zulassen; die neue Datenfreigabe muss zusätzlich die aktive Mitgliedschaft im betroffenen Büro verlangen.
7. **Alte Links werden teilweise nicht ausgewertet:** `DossiersMainView` initialisiert Tab und Auswahl nur lokal. Existierende Links verwenden `?id=`, `?dossier=` und `?tab=`. Für einen verlässlichen Bestandszugang müssen diese Varianten vereinheitlicht ausgewertet werden.
8. **Prüfskripte haben alte Pfade:** `lint:knowledge` verweist noch auf `src/components/KnowledgeBaseView.tsx`; `tsconfig.knowledge-strict.json` umfasst nur zwei Themen-Hooks. Neue Dateien müssen tatsächlich in den Prüfbereich aufgenommen werden.

## 3. Wiederverwendung

| Vorhanden | Verwendung in Phase B |
| --- | --- |
| `EnhancedLexicalEditor` | Vorhandenen Editor um einen kompakten Wissensmodus ergänzen: Text, einfache Formatierung, Listen, Links. Öffentlichen Bildupload, Kommentare, Änderungsverfolgung, Diktat und zusätzliche Arbeitsabläufe in diesem Modus deaktivieren. Bestehende Editor-Verbraucher behalten ihre bisherigen Vorgaben. Kein neuer Editor. |
| `RichTextDisplay`, `sanitizeRichHtml` | Sichere Antwortdarstellung. Strukturierte Editorinhalte validieren; HTML ausschließlich bereinigt anzeigen. Suchauszüge als Text rendern. |
| Lexical-Serialisierung in `useKnowledgeData.ts` | Inhaltsformat und vorhandene Tests als Grundlage nutzen; gemeinsam benötigte reine Hilfsfunktionen gegebenenfalls aus dem alten Daten-Hook lösen. Der alte Artikel-Hook bleibt sonst beim Bestand. |
| `KnowledgeVersionHistory`, `textDiff` | Darstellungsmuster und Vergleichsfunktion wiederverwenden. Die an Artikeltabellen gebundenen Hooks nicht für Fragen zweckentfremden. |
| Input, Button, Card, Badge, Dialog, Tabs, Select, Ladezustände | Bestehende UI-Komponenten und Design-Tokens verwenden. |
| Supabase Storage, Dateiauswahl und Downloadmuster | Wiederverwenden, aber mit privatem Wissensbucket und eindeutiger Frage-Anhang-Beziehung. `DecisionFileUpload` ist an Entscheidungen gebunden; keinen vollständigen Entscheidungs-/E-Mail-Workflow in die neue Oberfläche übernehmen. |
| TanStack Query und Mandanten-/Auth-Hooks | Neue kleine Hooks nach bestehendem Feature-Muster. Cache-Schlüssel enthalten Benutzer und Mandant; beim Wechsel keine alten Suchtreffer oder Editorzustände anzeigen. |
| Bestehendes Selbsttest-Center, Vitest, PGlite und Playwright | Neue Regeln in die vorhandenen Prüfwege integrieren. Laut `AGENTS.md` braucht jede neue Geschäftsregel bzw. jeder Workflow einen passenden Selbsttest-Schritt. |

## 4. Minimales Datenmodell

**Drei neue Tabellen.** Frage und maßgebliche Antwort liegen in einem Datensatz. Eine zusätzliche Antworttabelle bringt bei genau einer Antwort zunächst keinen Nutzen und erschwert gemeinsame Suche und atomare Änderungen.

### `knowledge_questions`

- `id`, `tenant_id`, `title` als Pflichtwerte; `description` und `assigned_to` optional.
- `created_by`, `created_at`, `updated_by`, `updated_at`: Datenbank setzt Bearbeiter und Zeit anhand der tatsächlichen Anmeldung.
- `answer_content` als validierter strukturierter Lexical-Inhalt; `answer_text` als daraus serverseitig abgeleiteter Suchtext. Links sind Bestandteil der Antwort. Eine HTML-Darstellung ist nur eine bereinigte Darstellung dieses Inhalts, keine unabhängige fachliche Antwort.
- `answered_by`, `answered_at`, `answer_updated_at`. Ohne nichtleeren Antworttext ist die Frage offen; keine zusätzliche Ticketstatusmaschine.
- `revision` für Schutz gegen verlorene gleichzeitige Bearbeitungen; `answer_revision` für die konkrete bestätigte Antwortfassung.
- `review_status`: `unverified`, `verified`, `needs_review`; `verified_by`, `verified_at`, `verified_answer_revision`, optional `review_due_at`.
- Gewichteter `search_vector` aus Titel und Antworttext, GIN-Index; zusätzliche Indizes für Mandant, offene Fragen und eigene Beiträge.

Die angezeigte verantwortliche Person ist `assigned_to`, andernfalls die Person, die die Antwort erstellt hat. Es gibt keine Pflichtzuordnung. „Meine Beiträge“ enthält eigene Fragen und Fragen mit eigenen Antwortbearbeitungen; die Historie liefert dafür die Autorenschaft. Eine zuständige Person wird zusätzlich an der Karte angezeigt, nicht mit dem Fragesteller gleichgesetzt.

### `knowledge_question_events`

- `id`, `tenant_id`, `question_id`, Datensatzrevision, Ereignistyp, tatsächlicher Akteur und Datenbankzeit.
- Automatische Snapshots bei Erstellung und Änderungen; Prüfungen und Prüfanforderungen referenzieren die betroffene Antwortrevision. Zuständigkeits- und Anhangänderungen werden ebenfalls erfasst.
- Nur serverseitig schreiben; Mitarbeiter können die Historie im Rahmen ihrer Leserechte lesen, aber keine Einträge manipulieren oder löschen. Keine manuelle Änderungsbeschreibung als Pflichtfeld.
- Inhaltsspeicherung und Historie erfolgen in einer Transaktion. Anders als beim bisherigen clientseitigen Artikel-Versionsablauf kann kein erfolgreiches Speichern ohne zugehörigen Verlauf entstehen.

### `knowledge_question_attachments`

- `id`, `tenant_id`, `question_id`, eindeutiger Storage-Pfad, ursprünglicher Dateiname, MIME-Typ, Größe, tatsächlicher Uploader und Zeit; interner Uploadzustand.
- Mandant und Frage müssen zusammenpassen: zusammengesetzte Beziehung auf `(tenant_id, question_id)`. Dieselbe Regel gilt für die Historie.
- Privater Bucket `knowledge-attachments`, Pfad `<tenant_id>/<question_id>/<attachment_id>`; Dateiname bleibt Metadatum.
- Upload reservieren, Datei übertragen, Anhang verbindlich zuordnen. Unvollständige Uploads sind kein sichtbarer Antwortanhang; Fehler werden angezeigt und verwaiste Uploads bereinigt. Größen-/Typgrenzen gelten auch am Bucket. Vorhandene Dateien werden nicht automatisch übernommen.

### Prüfregeln

| Auslöser | Ergebnis |
| --- | --- |
| Erste Antwort speichern | Beantwortet, „Ungeprüft“. |
| „Als aktuell geprüft markieren“ | Nur für vorhandene Antwort und erlaubte Aktion; Datenbank speichert Akteur, Zeitpunkt und exakt geprüfte Antwortrevision. |
| Gespeicherten Antwortinhalt ändern | Bestätigung in derselben Transaktion ungültig machen, „Ungeprüft“; frühere Bestätigung bleibt in der Historie. Konservativ gilt das auch für gespeicherte Formatänderungen sowie geänderte Links/Anhänge. Identische Speichervorgänge erzeugen keine neue Antwortfassung. |
| „Überprüfung anfordern“ | „Überprüfung erforderlich“, Anforderung in der Historie. |
| Optionales Prüfdatum erreicht | Datenbank liefert effektiv „Überprüfung erforderlich“. Keine Hintergrundbenachrichtigung und kein Scheduler erforderlich. |
| Nur Zuständigkeit ändern | Antwortbestätigung bleibt bestehen. |

Datumsprüfung erfolgt mit Datenbankzeit. Eine Anzeige darf nach dem Fälligkeitszeitpunkt nicht dauerhaft aus einem alten Cache „Geprüft“ behaupten. Eine erneute Bestätigung entfernt bzw. ersetzt ein bereits erreichtes Prüfdatum. Geprüft bedeutet ausschließlich manuell als aktuell bestätigt, keine Behauptung fachlicher oder politischer Richtigkeit.

Für Antworten, Prüfung und Zuständigkeit sind kleine datenbankseitige Schreibfunktionen vorgesehen. Diese prüfen aktive Mitgliedschaft, Aktionen und erwartete Revision und sperren den Datensatz während der Änderung. Gleichzeitige Bearbeitung führt zu einem verständlichen Konflikthinweis statt Überschreiben; eine Prüfung eines inzwischen geänderten Inhalts wird abgewiesen. Direkte API-Schreibzugriffe dürfen weder Auditierung noch Prüfregeln umgehen; Actor-/Prüffelder sind nicht vom Client frei setzbar.

## 5. Suche und Rechte

- PostgreSQL Full Text Search mit deutscher Konfiguration. Titel erhält Gewicht A, Antworttext Gewicht B; Ranking über `ts_rank_cd`, bei Gleichstand stabiles Sortierkriterium.
- Parametrisierte Suchfunktion `search_knowledge_questions`; `SECURITY INVOKER`, damit RLS auch für Suche, Auszüge und Zählwerte gilt. Keine zusammengesetzten PostgREST-Filter aus ungeprüfter Benutzereingabe.
- Rund 300 ms Verzögerung nach Eingabe; kurze Eingaben und deutsche Stoppwörter ausdrücklich behandeln. Sichere Präfixsuche für das letzte noch unvollständige Suchwort vorsehen; Suchsyntax nicht ungeprüft als `tsquery` übernehmen.
- Ergebnis: Frage, kurzer textueller Antwortauszug, effektiver Prüfstatus. Begrenzte Ergebnismenge mit Nachladen; keine Vollbestandsabfrage im Browser.
- Ohne Suchtext: zuletzt aktualisierte beantwortete Fragen. Bei keinem passenden Antworttreffer: „Diese Frage stellen“ übernimmt den eingegebenen Text. Bereits offene passende Fragen können ergänzend angezeigt werden, um doppelte Fragen zu vermeiden.
- Neue Fragen sind innerhalb ihres Mandanten gemeinsam sichtbar. Keine Veröffentlichung nach außen und keine Einzel-Freigabe pro Frage.
- RLS auf allen drei Tabellen: ausschließlich authentifizierte aktive Mitglieder des betreffenden Mandanten. Mandantenwechsel eines vorhandenen Datensatzes verhindern; Verantwortliche müssen im selben Büro aktiv sein. Nicht zugehörige Benutzer erhalten auch über erratene IDs, Historie, Suche und Dateipfade keinen Zugriff.
- Für Schreiben und Prüfen vorhandene `action_permissions` verwenden, mit `knowledge.write` und `knowledge.verify`. Vorschlag: standardmäßig alle aktiven Bürorollen zulassen, im bestehenden Berechtigungsmanager einschränkbar; kein neues Berechtigungssystem. Lesen erfordert aktive Büromitgliedschaft.
- Storage-Policies prüfen den tatsächlichen Fragebezug und dieselben Rechte. Kein öffentlicher URL-Zugriff; bevorzugt authentifizierter Blob-Download. Falls eine Vorschau signierte URLs benötigt, nur kurze Laufzeit und keine dauerhafte Speicherung; bis zum Ablauf bleibt eine ausgegebene URL nutzbar.
- Fragepflicht, sinnvolle Längen-/Größengrenzen, nichtleerer Antworttext, erlaubte Linkprotokolle und strukturierte Editorinhalte im Formular und serverseitig validieren. Neue Anhänge werden nicht als öffentliche Inline-Bilder eingebettet.

## 6. Oberfläche und Erhalt des Bestands

Primärroute: `/wissen`. Titel **Wissen**, großes Suchfeld **„Was möchtest du wissen?“**, sichtbarer Button **„Frage stellen“**. Drei einfache Ansichten: **Antworten**, **Offene Fragen**, **Meine Beiträge**. Keine Seitenleiste mit Ordnerbaum oder Filterleiste.

- Frageformular: Frage als einziges Pflichtfeld, optionale Beschreibung und zuständige Person. Nach Speichern zur offenen Frage; ohne Zuordnung speicherbar.
- Offene Fragen: Titel, Fragesteller, Datum, optionale Zuständigkeit. Direktes Öffnen zur Antwortbearbeitung.
- Wissenskarte: Frage und Antwort direkt sichtbar, Links, Anhänge, verantwortliche Person, Aktualisierungsdatum und Prüfstatus. Bearbeiten, manuell bestätigen und Prüfung anfordern als zurückhaltende Aktionen. Optionales Prüfdatum beim Prüfen, kein Pflichttermin.
- Lade-, Fehler- und echte Leerzustände unterscheiden; fehlgeschlagene Suche nie als „keine Treffer“ ausgeben. Eingaben bei fehlgeschlagenem Speichern erhalten. Tastaturbedienung und schmale Ansichten berücksichtigen.
- Untergeordneter Link **„Bisheriger Wissensbereich“** führt nach `/dossiers`. Dort bleiben alle fünf bisherigen Ansichten bedienbar.
- `/knowledge` und `/knowledge/:id` bleiben Artikelzugänge; `/wissen/fakten` bleibt Faktenzugang. Dossier-IDs, Artikel-IDs, Tags, bestehende Verknüpfungen, Versionen und Fakten-Picker werden nicht umgeschrieben. Bestehende Query-Linkvarianten für Dossiers auswerten.
- Neue Frage-Links können mit dem vorhandenen Router als `/wissen?frage=<id>` umgesetzt werden; Ansichten ebenfalls über Queryparameter. Kein umfangreicher Routingumbau.
- Den global sichtbaren `NavDossierCapture` im neuen Einstieg durch die gemeinsame Frageaktion ersetzen bzw. auf den Bestandskontext begrenzen. Neue und konfigurierte Schnellzugriffe klar unterscheiden; gespeicherte Links zum Bestand behalten ihr Ziel.
- Beim Umstellen des Feature-Exports die alte Ansicht in `DossiersMainView` ausdrücklich weiter importieren: dessen aktueller Default-Import aus `@/features/knowledge` darf nicht versehentlich den neuen Arbeitsbereich im Artikel-Tab laden.

**Kein Backfill:** Es werden keine alten Inhalte in Fragen umgewandelt, keine Datensätze gelöscht und keine alten Tabellen umgewidmet. Neue Suche durchsucht zunächst die neuen Fragen/Antworten. Für alte Dokumente bleibt die bisherige Suche im Bestandszugang verfügbar.

**Legacy-Sicherheit gesondert behandeln:** Der öffentliche gemeinsame Bucket und die historischen Artikel-Helper dürfen nicht als sicher abgenommen werden. Vor Phase-B-Abschluss den tatsächlichen Bestand prüfen, unzureichende Artikel-/Versionsrechte gezielt mit einer neuen Migration absichern und die Auswirkungen auf alte Ansichten testen. Für alte Dateien ist zunächst eine Zuordnung von Pfaden zu Mandanten und Verbrauchern erforderlich; erst danach kann ein kompatibler Übergang zu privaten bzw. authentifizierten Zugängen festgelegt werden. Keine pauschale Bucket-Umstellung oder automatische Dateiverschiebung. Offene Legacy-Dateirisiken ausdrücklich dokumentieren; ein privater neuer Bucket beseitigt sie nicht rückwirkend. Eine vollständige Sanierung des projektweit genutzten Dateibuckets ist ein separates Vorhaben, falls sich der Befund live bestätigt.

## 7. Konkreter Plan für Phase B

Die Migrationsnamen sind vorgeschlagene Suffixe. Zeitstempel werden bei Umsetzung nach der dann aktuellen letzten Migration vergeben; keine alte Migration verändern.

| Schritt | Betroffene Dateien / neue Migrationen | Fertig, wenn … |
| --- | --- | --- |
| 1. Datenmodell und Rechte | Neu: `supabase/migrations/<zeitstempel>_knowledge_qa_core.sql`; `src/features/knowledge/types.ts`, `logic.ts`, `validation.ts`; aktualisierte `src/integrations/supabase/types.ts`. Bestehenden `PermissionsManager.tsx` um die zwei Aktionen ergänzen. | Drei Tabellen, Constraints, RLS, atomare Schreib-/Prüffunktionen und Historie funktionieren; fremde Büro-IDs und manipulierte Actor-Felder scheitern. Zielkatalog zuvor abgeglichen. |
| 2. Klassische Suche | Neu: `<zeitstempel>_knowledge_qa_search.sql`, `src/features/knowledge/hooks/useKnowledgeSearch.ts`. | FTS mit Index, Titelgewichtung, sicherer Eingabe und RLS liefert begrenzte Ergebnisse; Debounce und veraltete Antworten sind behandelt. |
| 3. Stellen und Antworten | Neu: `hooks/useKnowledgeQuestions.ts`, `components/AskQuestionDialog.tsx`, `components/KnowledgeAnswerEditor.tsx`; gezielte Erweiterung von `src/components/lexical/EnhancedLexicalEditor.tsx` und Toolbar/Plugins für Wissensmodus. Neu: `<zeitstempel>_knowledge_qa_storage.sql`, `components/KnowledgeAttachments.tsx`. | Frage ohne Metadatenpflicht und Antwort ohne Freigabe speicherbar; Links und private Anhänge funktionieren auch bei Fehlern. |
| 4. Karten und Prüfung | Neu: `components/KnowledgeQuestionCard.tsx`, kleine Historienansicht unter Wiederverwendung bestehender Diff-/Dialogbausteine. | Antwort ist direkt lesbar, Prüfstatus korrekt, Prüfung und Rücksetzung mit nachvollziehbarer Historie; konkurrierende Änderungen werden erkannt. |
| 5. Offene und eigene Beiträge | Neu: `components/KnowledgeWorkspace.tsx`; Listen auf denselben Hooks und Karten. | Offene Fragen unmittelbar beantwortbar; eigene Fragen/Antwortbearbeitungen auffindbar; optionale Zuständigkeit änderbar. |
| 6. Primärer Einstieg und Legacy | `src/features/knowledge/index.ts`, `src/pages/Index.tsx`, `src/components/navigation/navigationConfig.ts`, `AppNavigation.tsx`, `src/lib/routePrefetch.ts`, gegebenenfalls `src/lib/tenant-modules.ts`, `src/components/widgets/QuickActionsWidget.tsx`; `DossiersMainView.tsx` und globaler Erfassungseinstieg. Bei bestätigten Rechtefehlern neu: `<zeitstempel>_knowledge_legacy_access.sql`. | Navigation führt nach `/wissen`, Bestandszugang und vorhandene Einzel-/Fakten-/Dossierlinks funktionieren; alte Daten behalten IDs und Beziehungen. |
| 7. Qualität und Abnahme | Neu: fokussierte Vitest-Tests, `scripts/test-knowledge-qa.mjs` mit vorhandener PGlite-Testinfrastruktur, `e2e/knowledge.spec.ts`, `src/features/selftest/scenarios/knowledge-lifecycle.ts`; Anpassung von Selbsttest-Registry/-Abdeckung, `tests/database/package.json`, `package.json`, `tsconfig.knowledge-strict.json`. | Nachstehende Matrix geprüft; Typprüfung, gezieltes Linting, relevanter Build und Regressionstests erfolgreich. Echte Storage-Prüfung in isolierter Supabase-Testumgebung. |

## 8. Prüf- und Abnahmematrix

1. **Bedienung:** Frage mit nur Titel erstellen; ohne Zuständigkeit speichern; einfache Antwort veröffentlichen; direkt lesen; offene Frage beantworten; eigene Beiträge wiederfinden; Fehler lassen Texte erhalten.
2. **Suche:** Titel- vor Antworttreffer; deutsche Wortformen, Umlaute, Mehrwortsuche, unvollständiges letztes Wort, Stoppwörter, leere Eingabe, Sonderzeichen; keine Treffer → Frage vorgefüllt. Verspätete Ergebnisse überschreiben keinen neueren Suchstand.
3. **Bürogrenzen und Rollen:** Mindestens zwei existierende Testmandanten und getrennte Konten. Fremde IDs in SELECT/INSERT/UPDATE/RPC, Suche, Historie und Anhängen; inaktive Mitgliedschaft; Zuordnung fremder Mitarbeiter; Mandantenwechsel und Benutzerwechsel im Browser. Beide Aktionssperren auch durch direkte API-Aufrufe prüfen. Tests laufen als eingeschränkte Rollen, nicht nur als Datenbankeigentümer.
4. **Prüfstatus:** Erste Antwort ungeprüft; manuelle Prüfung mit echtem Akteur/Zeit; Inhalts-, Link- und Anhangänderung invalidieren; reine Zuständigkeitsänderung nicht; Prüfung anfordern; Datum vor/bei/nach Fälligkeit; identisches Speichern; Prüfung einer veralteten Antwortrevision; zwei gleichzeitige Bearbeitungen. Alte Bestätigungen bleiben historisch sichtbar.
5. **Dateien und Inhaltssicherheit:** Anonymer/fremder Download, erratene Pfade, veränderte Metadaten, unvollständige Uploads, falsche Frage-Mandant-Kombination, Größen-/Typgrenzen und entzogene Mitgliedschaft. XSS/gefährliche URLs über eingefügte Inhalte und Suchauszüge testen. PGlite allein prüft keine echten Storage-Downloads.
6. **Bestand:** Vorher-/Nachher-Abgleich von IDs, Anzahlen und Beziehungen der betroffenen Bestandsdaten in einer Testkopie; Artikelversionen, Fakt-Picker in Terminvorbereitung/Kontakten sowie Dossier-Verknüpfungen und alte Links öffnen. Migrationen verändern keine bestehenden Wissensinhalte.
7. **Keine KI:** Neue Wissenspfade verwenden ausschließlich Auth-, Datenbank- und Storage-Zugriffe; keine AI-Clients, Edge-KI-Aufrufe, Embeddings oder externen Suchdienste. Editor-Wissensmodus enthält keine Sprach-/Assistenzaktionen.

In Phase A wurden keine Abnahmetests für die neue Lösung durchgeführt, da sie noch nicht implementiert ist. Die bestehenden gezielten Vitest-Tests konnten ohne installierte lokale Testabhängigkeiten nicht gestartet werden. Es wurden keine Abhängigkeiten installiert und keine Tests gegen Produktivdaten ausgeführt.

## 9. Freigabepunkt

Zur Freigabe steht: neuer gemeinsamer Frage-Antwort-Bereich unter `/wissen`, drei additive Tabellen, klassische PostgreSQL-Suche, private neue Anhänge, atomare Historie/Prüfregeln, einfacher Bestandszugang und die oben genannten Tests. Default: aktive Bürorollen dürfen stellen, bearbeiten und prüfen; bestehende Aktionsverwaltung kann Schreiben und Prüfen einschränken. Änderungen am projektweiten öffentlichen Dateibestand werden nicht stillschweigend vorgenommen.

Phase B beginnt erst nach ausdrücklicher Freigabe dieses Plans durch den Auftraggeber, entsprechend dessen Vorgabe in Abschnitt 12 des Auftrags.

# Wissen: Betrieb und Abnahme

Die neue Hauptansicht liegt unter `/wissen`. Sie bietet Antworten, offene Fragen und eigene Beiträge. `/dossiers`, `/knowledge`, `/knowledge/:id` und `/wissen/fakten` bleiben Bestandszugänge. Dossierlinks mit `id`, `dossier` und `tab` werden weiterhin ausgewertet. Bestehende Inhalte werden weder gelöscht noch automatisch umgewandelt.

## Datenbank-Rollout

Die Implementierung liefert vier neue Migrationen in dieser Reihenfolge:

1. `20261110180000_knowledge_qa_core.sql`: Fragen mit einer Antwort, unveränderlicher Verlauf, Anhangmetadaten, RLS, Schreib-/Prüffunktionen und Selbsttest.
2. `20261110180100_knowledge_qa_search.sql`: deutsche Volltextsuche mit Titelgewichtung, Präfixsuche und mandantengeschützter Kartenansicht.
3. `20261110180200_knowledge_qa_storage.sql`: privater Bucket und zusätzliche einschränkende Storage-Policies, die auch neben älteren großzügigen Policies gelten.
4. `20261110180300_knowledge_legacy_access.sql`: mandantenbezogene Artikelrechte, Schutz für untergeordnete Daten und unveränderliche Büro-/Autorzuordnung.

Diese Migrationen wurden in isoliertem PostgreSQL ausgeführt und getestet. Die laufende Supabase-Instanz wurde nicht migriert: In der Arbeitsumgebung stehen weder ein privilegierter Datenbankzugang noch eine authentifizierte Supabase-Verwaltungsverbindung bereit. Ein Git-Push bestätigt keinen erfolgreichen Datenbank-Rollout.

Vor dem normalen Supabase-Rollout den tatsächlichen Migrationsstand und Katalog abgleichen. Historische Migrationen enthalten widersprüchliche Helper- und Policy-Definitionen; ein vollständiges Neuaufsetzen aus der Historie ist durch diesen Patch nicht verifiziert. Insbesondere Tabellen/Spalten der Artikel, Rechte, Versionen und Snapshots sowie vorhandene Storage-Policies kontrollieren. Die neue Legacy-Migration berücksichtigt, dass Snapshots je nach historischem Stand keine `tenant_id` haben.

Nützliche lesende Vorabprüfung im SQL-Editor:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename like 'knowledge_%' or schemaname = 'storage';

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name like 'knowledge_%'
order by table_name, ordinal_position;

select id, public, file_size_limit from storage.buckets
where id in ('documents', 'knowledge-attachments');
```

Vor und nach dem Rollout in einer Testkopie IDs, Anzahlen und Beziehungen der Dossiers, Einträge, Artikel, Fakten und Versionen vergleichen. Neue Migrationen verändern diese Inhalte nicht. Anschließend mit zwei echten Testbüros und getrennten angemeldeten Konten die Kartenansicht, FTS und insbesondere Storage-HTTP-Zugriffe prüfen. Der Browser-Funktionstest simuliert Supabase; die PostgreSQL-Tests führen die tatsächlichen Policies aus. Keiner davon ersetzt einen Storage-Test auf einer Supabase-Testinstanz.

## Rechte und Prüfstatus

- Lesen setzt eine aktive Mitgliedschaft im jeweiligen Büro voraus. Neue Einträge sind bürointern gemeinsam sichtbar, ohne öffentliche Veröffentlichung.
- `knowledge.write` steuert Stellen, Beantworten, Zuständigkeit und Anhänge; `knowledge.verify` steuert Bestätigen und Anfordern einer Prüfung. Ohne Eintrag in der vorhandenen Aktionsverwaltung sind alle aktiven Bürorollen zugelassen. Die UI-Sperre wird in der Datenbank erneut geprüft.
- Direkte Client-Schreibzugriffe auf die neuen Tabellen sind gesperrt. Actor, Zeitpunkt, Revision und Verlauf stammen aus dem tatsächlichen Datenbankvorgang.
- Eine Bestätigung gilt für genau eine Antwortrevision. Jede gespeicherte Antwortänderung, einschließlich Formatierung, Links und veröffentlichter Anhänge, setzt sie und das zugehörige Prüfdatum zurück. Identisches Speichern und reine Zuständigkeitsänderung erhalten die Bestätigung.
- Der optionale Prüftermin wird mit Datenbankzeit ausgewertet; die Kartenansicht berücksichtigt auch den Fälligkeitszeitpunkt während einer geöffneten Sitzung. Eine Bestätigung bedeutet „manuell auf Aktualität geprüft“.
- Veraltete Revisionen werden abgewiesen. Entwürfe bleiben bei Speicherfehlern erhalten. Die Bestätigungsaktion verwendet die Revision beim Öffnen der Prüfung.
- Links und Editorstruktur werden serverseitig validiert; Suchtext wird aus derselben Struktur abgeleitet. Beliebiges HTML, Inline-Bilder, Kommentare, Diktat, externe Assistenz- oder KI-Funktionen gehören nicht zum Wissensmodus. Eingefügte freie CSS-Stile werden entfernt.

## Dateien

Neue Anhänge liegen ausschließlich im privaten Bucket `knowledge-attachments`, mit Pfad aus Büro-, Frage- und Anhang-ID. Authentifizierte Downloads verwenden die Storage-API, keine öffentlichen oder dauerhaft gespeicherten signierten URLs. Metadaten und Storage-Policies prüfen denselben Frage-/Bürobezug.

Erlaubt sind PDF, Text/CSV, PNG/JPEG/WebP und die unterstützten Word-/Excel-Formate bis 20 MB. Dateien werden nach dem ersten Speichern einer Antwort angehängt. Ein reservierter Upload erscheint erst nach erfolgreichem Abschluss an der Karte. Abgebrochene Uploads werden soweit möglich bereinigt. Ein entferntes Dokument wird zuerst aus der Antwort genommen und entwertet deren Bestätigung; bei fehlgeschlagener physischer Dateibereinigung erscheint ein Hinweis. Die entfernte Metadatenzeile bleibt zur Zuordnung erhalten. Schreibberechtigte können die Storage-Bereinigung wiederholen.

**Bestehender Befund:** Die historische Migration `20260407155349_3f4f564a-2f5c-450a-a1a6-288e06ac2647.sql` macht den gemeinsam genutzten Bucket `documents` öffentlich. Dieser Patch schaltet ihn nicht pauschal um, weil auch Pressebilder, Redaktionsplanung, Editorbilder und Belege öffentliche URLs verwenden. Neue Wissensanhänge nutzen ihn nicht. Alte öffentliche Dateien werden durch die neue Oberfläche nicht rückwirkend geschützt. Dafür bleibt eine Bestandsaufnahme mit kompatibler Umstellung der jeweiligen Verbraucher erforderlich.

## Durchgeführte Prüfungen

- `npm run test:knowledge:db`: tatsächliche neue SQL-Migrationen unter eingeschränkten PostgreSQL-Rollen, zwei Büros, inaktive Mitgliedschaft, fremde Zuständigkeit, direkte Schreibversuche, FTS/Ranking/Wortformen, Revisionen, Bestätigung/Rücksetzung, Anhang-Policies und erhaltene Bestandsdaten.
- `npm --prefix tests/database test`: vorhandene Datenbank-Regressionssuite einschließlich des neuen Wissenstests.
- `npm run typecheck:knowledge` und `npm run lint:knowledge`: neuer Bereich; die Typprüfung umfasst auch die eingebundenen Editor- und Legacy-Abhängigkeiten. Lint prüft den neuen Bereich, während die unveränderte alte Artikeloberfläche ihre bekannten Legacy-Warnungen behält.
- Vitest: Wissensregeln, verzögerte Antworten beim Büro-Wechsel, Ausführung des neuen Selbsttests sowie vorhandene Lexical-Serialisierung.
- Playwright-Projekt `knowledge`: Stellen ohne Zuständigkeit, Beantworten, Konflikt mit erhaltenem Entwurf, manuelle Bestätigung, Entwertung nach Bearbeitung, Prüfanforderung, Anhang, Suche, Übernahme als neue Frage, Fehlerzustand, Desktop/Mobil und Bestandszugang. Serviceaufrufe werden vollständig simuliert.
- `npm run build` und Selbsttest-Abdeckungsprüfung bestanden. Der zusätzlich ausgeführte projektweite Edge-Sicherheitscheck meldet bestehende Befunde (siehe unten).

Das Selbsttest-Center verwendet `knowledge_qa_selftest`: Es führt die tatsächlichen Speicher-, Historien- und Prüfoperationen mit den aktuellen Rechten aus und rollt sämtliche Testdaten und Ereignisse in einer Untertransaktion zurück. Es benötigt keine besondere Löschberechtigung. Bei einer Schreib- oder Prüfsperre testet es die entsprechende Ablehnung. Anhang-HTTP-Zugriffe sind darin nicht enthalten.

Bekannte Befunde außerhalb dieses Änderungenumfangs:

- `src/utils/__tests__/htmlSanitizer.test.ts` hat einen bestehenden fehlgeschlagenen Test: DOMPurify erhält die Zeichenfolge `javascript:` in einem nicht ausführbaren `data-meta`-Attribut, während die Assertion diese Zeichenfolge auch dort verbietet. Der neue Wissensmodus rendert kein solches HTML.
- Der projektweite Edge-Sicherheitscheck meldet vorhandene Inventar-/Konfigurationsabweichungen sowie Sicherheitsbefunde in bestehenden Edge Functions. Keiner seiner Eingabebestände wurde durch diese Implementierung verändert.
- `npm run typecheck:selftest` meldet 16 bestehende Fehler in Meeting-/Redaktions- und Quick-Note-Dateien. Der unveränderte Ausgangscommit wurde separat geprüft: Dateien, Positionen und Fehlercodes sind identisch. Die neuen Wissensdateien bestehen ihre eigene Typprüfung.

Es wurden keine neuen Laufzeitabhängigkeiten und keine KI-Dienste hinzugefügt. Die Installation des vorhandenen Lockfiles erforderte `npm ci --legacy-peer-deps`, da der Bestand inkompatible ESLint-Peer-Vorgaben enthält.

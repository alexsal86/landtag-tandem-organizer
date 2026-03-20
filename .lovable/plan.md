
Problem:
- Meine Arbeit/Vorgänge lädt Fallakten direkt aus `case_files` und funktioniert deshalb teilweise weiter.
- Die Akten-Seite hängt an zwei separaten Stellen:
  1. `get_case_files_with_counts` ist sehr wahrscheinlich fachlich kaputt: Im RPC ist `processing_statuses` als `jsonb` definiert, in `case_files` aber als `text[]`; zusätzlich ist `assigned_to` im RPC `text`, in der Tabelle aber `uuid`.
  2. `CaseFilesView` blockiert die ganze Seite mit `loading || typesLoading`; `useCaseFileTypes` startet mit `loading=true` und ist dadurch ein zusätzlicher Single Point of Failure.

Umsetzung:
1. RPC korrigieren
- `get_case_files_with_counts` auf die echten DB-Typen anpassen (`assigned_to uuid`, `processing_statuses text[]` oder sauber casten).
- Gleichzeitig die Sichtbarkeitslogik in den RPC übernehmen. Der RPC läuft als `SECURITY DEFINER` und umgeht aktuell RLS; ohne zusätzlichen Filter würde er sonst private Akten tenant-weit offenlegen.

2. Akten-Seite robuster machen
- `useCaseFileTypes` so anpassen, dass `loading` nicht hängen bleibt, wenn Tenant/Auth verzögert geladen wird.
- `CaseFilesView` nur wegen der Akten selbst blockieren, nicht wegen der Typ-Konfiguration.
- Wenn Typen fehlen oder fehlschlagen, mit Fallbacks rendern statt die komplette Liste zu verstecken.

3. Fehler sichtbar und konsistent machen
- `useCaseFiles` auf den projektweiten Fehlerpfad (`handleAppError`) umstellen, damit echte Supabase-/RPC-Meldungen sauber verarbeitet werden.
- Die temporären `console.*`-Logs wieder auf Projektstandard (`debugConsole`) zurückführen.

4. Konsistenzfix beim Öffnen
- Deep-Link-Parameter vereinheitlichen (`caseFileId` vs. `casefile`), damit Öffnen aus Suche und anderen Bereichen zuverlässig dieselbe Akte lädt.

Technische Details:
- Daten sind vorhanden: `case_files` und `case_file_types` enthalten Datensätze.
- Der Workspace-Hook funktioniert, weil er direkt auf `case_files` zugreift.
- Der Standalone-Hook nutzt den RPC und ist damit der wahrscheinlichste eigentliche Fehlerpunkt.
- Zusätzlich verschärft das aktuelle Loading-Gating im Frontend das Problem, weil selbst ein Typen-Problem die gesamte Akten-Seite blockiert.

Abnahme:
- Akten-Seite zeigt wieder Fallakten.
- In Meine Arbeit/Vorgänge erscheint kein Lade-/Fehlerzustand mehr für Fallakten.
- Suche/Deep Links öffnen die richtige Akte.
- Private/geteilte Sichtbarkeit bleibt korrekt erhalten.

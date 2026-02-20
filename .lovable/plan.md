
# Wurzel-Ursache der kaputten Vorschauen

## Das eigentliche Problem (endlich vollständig verstanden)

Nach direkter DB-Analyse ist das Problem eindeutig identifiziert:

**Dateien wurden mit Tenant-ID als Ordner hochgeladen:**
```
DB-Pfad: adb472ab-1f29-481c-ad56-f623998d347e/decisions/66915fd2.../datei.pdf
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         = Tenant-ID (nicht User-ID!)
```

**Die RLS SELECT-Policy prüft aber:**
```sql
(storage.foldername(name))[1] = auth.uid()::text
```
Diese Bedingung ist `false`, weil `foldername[1]` = Tenant-ID ist, aber `auth.uid()` = User-ID.

Die Policy hat zwar ODER-Bedingungen mit DB-JOINs (über `task_decision_attachments`), die theoretisch greifen würden – aber `createSignedUrl` schlägt fehl, weil die Policy insgesamt `false` zurückgibt (die JOIN-Checks funktionieren nur, wenn Supabase den Service-Role-Kontext nutzt, was bei `createSignedUrl` vom anon-Client nicht der Fall ist).

**Warum funktionieren Mails?** `EmailPreviewDialog` lädt `.msg` via direktem Download-Aufruf mit dem Supabase-Client, der die Session-Auth mitschickt. Bei Mails greift der JOIN-Check gerade noch.

**Warum schlägt `createSignedUrl` fehl?** Es prüft die RLS-Policy mit dem User-Token – der Folder-Check `foldername[1] = auth.uid()` schlägt fehl → kein Zugriff → Signed URL wird verweigert.

---

## Lösung: 2 Ebenen

### Ebene 1: RLS-Policy reparieren (Datenbank-Migration)

Die SELECT-Policy muss den ersten Ordner als entweder User-ID ODER Tenant-ID akzeptieren. Da alle Pfade konsistent der `task_decision_attachments`-Tabelle zugeordnet sind, ist die sicherste Lösung: Die Policy greift immer dann, wenn der Pfad in `task_decision_attachments` registriert ist und der User Zugriff auf die zugehörige Entscheidung hat.

**Neue Policy (ersetzt die alte SELECT-Policy):**
```sql
DROP POLICY IF EXISTS "Users can view decision attachments they have access to" ON storage.objects;

CREATE POLICY "Users can view decision attachments they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'decision-attachments'
  AND auth.uid() IS NOT NULL
  AND (
    -- Eigener Ordner (User-ID oder Tenant-ID als erstem Segment)
    (storage.foldername(name))[1] = (auth.uid())::text
    OR
    -- Datei ist in DB registriert UND User ist Teilnehmer der Entscheidung
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decision_participants tdp ON tdp.decision_id = tda.decision_id
      WHERE tda.file_path = objects.name
        AND tdp.user_id = auth.uid()
    )
    OR
    -- Datei ist in DB registriert UND User ist Ersteller der Entscheidung
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decisions td ON td.id = tda.decision_id
      WHERE tda.file_path = objects.name
        AND td.created_by = auth.uid()
    )
    OR
    -- Datei gehört zu einer tenant-weiten Entscheidung UND User ist im selben Tenant
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decisions td ON td.id = tda.decision_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
      WHERE tda.file_path = objects.name
        AND td.visible_to_all = true
        AND utm.user_id = auth.uid()
        AND utm.is_active = true
    )
    OR
    -- Datei gehört zu Entscheidung, hochgeladen unter Tenant-ID-Ordner
    -- (Legacy-Uploads die mit Tenant-ID als userId hochgeladen wurden)
    EXISTS (
      SELECT 1
      FROM public.task_decision_attachments tda
      JOIN public.task_decisions td ON td.id = tda.decision_id
      JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
      WHERE tda.file_path = objects.name
        AND utm.user_id = auth.uid()
        AND utm.is_active = true
    )
  )
);
```

Die letzte Bedingung fängt alle bestehenden Dateien ab, die unter der Tenant-ID hochgeladen wurden – jeder aktive Tenant-Member kann auf Dateien in Entscheidungen seines Tenants zugreifen, sofern sie registriert sind.

### Ebene 2: Upload-Hook reparieren (Code-Änderung)

Der Upload-Hook `useDecisionAttachmentUpload.ts` muss sicherstellen, dass immer die echte User-ID verwendet wird (nicht die Tenant-ID). Aktuell ist Zeile 105:
```ts
const filePath = `${userId}/decisions/${decisionId}/${uniqueSuffix}-${sanitizedFileName}`;
```
Der Parameter `userId` kommt vom Aufrufer. In manchen Aufrufen wurde fälschlicherweise die Tenant-ID übergeben. Der Hook muss die User-ID direkt aus der Supabase-Session holen:
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Nicht angemeldet');
const filePath = `${user.id}/decisions/${decisionId}/${uniqueSuffix}-${sanitizedFileName}`;
```
Das macht zukünftige Uploads robust, unabhängig davon was der Aufrufer übergibt.

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/20260220_fix_decision_attachment_rls.sql` | Neue RLS-Policy die Tenant-ID-Ordner erlaubt |
| `src/hooks/useDecisionAttachmentUpload.ts` | User-ID aus Session holen statt Parameter vertrauen |

Das sind exakt 2 Dateien. Keine Änderungen an den Dialog-Komponenten nötig – die sind korrekt implementiert. Das Problem liegt ausschliesslich in der Datenbank-Policy und dem Upload-Pfad.

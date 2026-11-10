import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ATTACHMENT_TYPES, validateAttachment } from '../logic';
import { knowledgeKey, useKnowledgeAttachments, useKnowledgeScope, useKnowledgeWrite } from '../hooks/useKnowledgeQuestions';
import type { KnowledgeAttachment, KnowledgeQuestion } from '../types';

export function KnowledgeAttachments({ question, canWrite }: { question: KnowledgeQuestion; canWrite: boolean }) {
  const query = useKnowledgeAttachments(question.id);
  const scope = useKnowledgeScope();
  const client = useQueryClient();
  const write = useKnowledgeWrite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async (file: KnowledgeAttachment) => {
    setError('');
    try {
      const { data, error: failure } = await supabase.storage.from('knowledge-attachments').download(file.storage_path);
      if (failure) throw failure;
      const url = URL.createObjectURL(data); const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.file_name;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Die Datei konnte nicht heruntergeladen werden.'); }
  };
  return <div className="space-y-2">
    {query.isLoading && <p className="text-xs text-muted-foreground">Anhänge werden geladen …</p>}
    {query.isError && <p role="alert" className="text-sm text-destructive">Anhänge konnten nicht geladen werden. <button className="underline" onClick={() => void query.refetch()}>Erneut versuchen</button></p>}
    {query.data?.map(file => <div key={file.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm"><Paperclip className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-all">{file.file_name}</span><Button variant="ghost" size="icon" aria-label={`${file.file_name} herunterladen`} onClick={() => void download(file)}><Download className="h-4 w-4" /></Button>{canWrite && <Button variant="ghost" size="icon" aria-label={`${file.file_name} entfernen`} disabled={busy || write.isPending} onClick={async () => {
      setError(''); setBusy(true);
      try {
        await write.mutateAsync({ name: 'knowledge_qa_finish_attachment', args: { p_attachment: file.id, p_expected_revision: question.revision, p_remove: true } });
        const { error: failure } = await supabase.storage.from('knowledge-attachments').remove([file.storage_path]);
        if (failure) setError('Der Anhang wurde entfernt. Die Dateibereinigung ist noch ausstehend.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Der Anhang konnte nicht entfernt werden.'); }
      finally { setBusy(false); }
    }}><X className="h-4 w-4" /></Button>}</div>)}
    {canWrite && <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-primary hover:underline"><Paperclip className="h-4 w-4" />{busy ? 'Datei wird übertragen …' : 'Datei anhängen'}<input className="sr-only" aria-label="Datei anhängen" type="file" accept={ATTACHMENT_TYPES.join(',')} disabled={busy || write.isPending} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      const invalid = validateAttachment(file); if (invalid) { setError(invalid); return; }
      setBusy(true); setError(''); let reservation: KnowledgeAttachment | null = null;
      try {
        const { data, error: failure } = await supabase.rpc('knowledge_qa_reserve_attachment', { p_question: question.id, p_name: file.name, p_type: file.type, p_size: file.size }).single();
        if (failure) throw new Error(failure.message); reservation = data;
        const uploaded = await supabase.storage.from('knowledge-attachments').upload(data.storage_path, file, { contentType: file.type, upsert: false });
        if (uploaded.error) throw uploaded.error;
        await write.mutateAsync({ name: 'knowledge_qa_finish_attachment', args: { p_attachment: data.id, p_expected_revision: question.revision } });
      } catch (cause) {
        if (reservation) {
          await supabase.storage.from('knowledge-attachments').remove([reservation.storage_path]);
          // Cancel using the current revision if another colleague edited meanwhile.
          const latest = await supabase.from('knowledge_questions').select('revision').eq('tenant_id', scope.tenantId!).eq('id', question.id).maybeSingle();
          if (latest.data) await supabase.rpc('knowledge_qa_finish_attachment', { p_attachment: reservation.id, p_expected_revision: latest.data.revision, p_remove: true });
        }
        setError(cause instanceof Error ? cause.message : 'Die Datei konnte nicht angehängt werden.');
      } finally { setBusy(false); await client.invalidateQueries({ queryKey: knowledgeKey(scope.userId, scope.tenantId) }); }
    }} /></label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

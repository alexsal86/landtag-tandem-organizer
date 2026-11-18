import { useState } from 'react';
import SimpleRichTextEditor, { type SimpleRichTextEditorProps } from '@/components/ui/SimpleRichTextEditor';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { SelectedTextTaskDialog } from './SelectedTextTaskDialog';

export function QuickNoteRichTextEditor(props: SimpleRichTextEditorProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;
  const [draft, setDraft] = useState<{ text: string; userId: string; tenantId: string } | null>(null);

  return (
    <>
      <SimpleRichTextEditor
        {...props}
        enableChecklists
        onDictatedTaskDraft={userId && tenantId
          ? (text) => setDraft({ text, userId, tenantId })
          : undefined}
      />
      {draft && draft.userId === userId && draft.tenantId === tenantId && (
        <SelectedTextTaskDialog
          text={draft.text}
          userId={draft.userId}
          tenantId={draft.tenantId}
          onClose={() => setDraft(null)}
        />
      )}
    </>
  );
}

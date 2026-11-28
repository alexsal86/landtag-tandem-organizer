import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';

const QUICK_TYPES = new Set(['task_decision_request', 'task_decision_digest']);

interface QuickResponseNotification {
  data?: unknown;
  notification_types?: { name?: string | null } | null;
}

interface DecisionQuickResponseProps {
  notification: QuickResponseNotification;
  onDone?: () => void;
}

/** Direkt aus einer Meldung abstimmen, ohne zuerst die Entscheidung zu öffnen. */
export const DecisionQuickResponse = ({ notification, onDone }: DecisionQuickResponseProps) => {
  const [saving, setSaving] = useState<string | null>(null);
  const typeName = notification.notification_types?.name ?? '';
  const data = (notification.data ?? {}) as { decision_id?: unknown };
  const decisionId = typeof data.decision_id === 'string' ? data.decision_id : null;

  if (!decisionId || !QUICK_TYPES.has(typeName)) return null;

  const respond = async (event: MouseEvent<HTMLButtonElement>, responseType: 'yes' | 'no' | 'question') => {
    event.stopPropagation();
    setSaving(responseType);
    const { error } = await supabase.rpc('respond_to_decision', {
      _decision_id: decisionId,
      _response_type: responseType,
    });
    setSaving(null);

    if (error) {
      notify.error('Antwort nicht gespeichert', { description: error.message });
      return;
    }

    notify.success('Antwort gespeichert');
    onDone?.();
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={saving !== null} onClick={(event) => void respond(event, 'yes')}>
        {saving === 'yes' ? 'Speichert…' : 'Ja'}
      </Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={saving !== null} onClick={(event) => void respond(event, 'no')}>
        {saving === 'no' ? 'Speichert…' : 'Nein'}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={saving !== null} onClick={(event) => void respond(event, 'question')}>
        {saving === 'question' ? 'Speichert…' : 'Rückfrage'}
      </Button>
    </div>
  );
};

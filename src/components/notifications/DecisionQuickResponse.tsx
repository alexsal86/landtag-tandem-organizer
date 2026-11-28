import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getDefaultOptions, type ResponseOption } from '@/lib/decisionTemplates';
import { notify } from '@/lib/notify';

const QUICK_TYPES = new Set([
  'task_decision_request',
  'task_decision_digest',
  'task_decision_deadline_reminder',
]);

interface QuickResponseNotification {
  data?: unknown;
  notification_types?: { name?: string | null } | null;
}

interface DecisionQuickResponseProps {
  notification: QuickResponseNotification;
  onDone?: () => void;
}

/** Direkt aus einer Meldung mit den konfigurierten Antwortoptionen abstimmen. */
export const DecisionQuickResponse = ({ notification, onDone }: DecisionQuickResponseProps) => {
  const navigate = useNavigate();
  const [options, setOptions] = useState<ResponseOption[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const typeName = notification.notification_types?.name ?? '';
  const data = (notification.data ?? {}) as { decision_id?: unknown; creator_warning?: unknown };
  const decisionId = typeof data.decision_id === 'string' ? data.decision_id : null;
  // Der Ersteller kann nicht selbst abstimmen; seine Fristwarnung zeigt keine
  // Schnellantworten, sondern führt nur zur Entscheidung.
  const isQuickType = Boolean(decisionId) && QUICK_TYPES.has(typeName) && data.creator_warning !== true;

  useEffect(() => {
    if (!decisionId || !isQuickType) return;
    let cancelled = false;

    void supabase
      .from('task_decisions')
      .select('response_options')
      .eq('id', decisionId)
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (cancelled) return;
        if (error) {
          notify.error('Antwortoptionen nicht ladbar', { description: error.message });
          return;
        }
        const configured = row?.response_options;
        setOptions(Array.isArray(configured) && configured.length > 0
          ? configured as unknown as ResponseOption[]
          : getDefaultOptions());
      });

    return () => { cancelled = true; };
  }, [decisionId, isQuickType]);

  if (!decisionId || !isQuickType) return null;

  const respond = async (event: MouseEvent<HTMLButtonElement>, option: ResponseOption) => {
    event.stopPropagation();

    // Optionen mit Kommentarpflicht brauchen die Detailansicht, nicht einen stillen Klick.
    if (option.requires_comment) {
      onDone?.();
      navigate(`/decisions?highlight=${encodeURIComponent(decisionId)}&respond=1`);
      return;
    }

    setSaving(option.key);
    const { error } = await supabase.rpc('respond_to_decision', {
      _decision_id: decisionId,
      _response_type: option.key,
    });
    setSaving(null);

    if (error) {
      notify.error('Antwort nicht gespeichert', { description: error.message });
      return;
    }

    notify.success('Antwort gespeichert');
    onDone?.();
  };

  if (options.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
      {options.map((option, index) => (
        <Button
          key={option.key}
          size="sm"
          variant={index === 0 ? 'outline' : 'ghost'}
          className="h-7 px-2 text-xs"
          disabled={saving !== null}
          title={option.requires_comment ? 'Öffnet die Entscheidung für einen Kommentar' : option.label}
          onClick={(event) => void respond(event, option)}
        >
          {saving === option.key ? 'Speichert…' : option.label}
        </Button>
      ))}
    </div>
  );
};

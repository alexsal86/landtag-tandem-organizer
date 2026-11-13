/** @owner team-platform @secondary-owner team-office @feature team-rituals */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@/lib/notify';
export function useRitualAction(tenantId?: string) {
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function run(action: () => PromiseLike<{ error: { message: string } | null }>): Promise<boolean> {
    if (busy || !tenantId) return false;
    setBusy(true);
    try {
      const result = await action();
      if (result.error) { notify.error('Speichern fehlgeschlagen', { description: result.error.message }); return false; }
      await Promise.all(['team-rituals', 'team-quiz', 'team-bingo'].map(key => cache.invalidateQueries({ queryKey: [key, tenantId] })));
      notify.success('Gespeichert');
      return true;
    } catch { notify.error('Speichern fehlgeschlagen. Bitte erneut versuchen.'); return false; }
    finally { setBusy(false); }
  }
  return { busy, run };
}

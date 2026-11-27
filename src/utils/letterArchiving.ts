import { supabase } from '@/integrations/supabase/client';
import { getActiveTenantScope } from '@/integrations/supabase/tenantScope';
import { debugConsole } from '@/utils/debugConsole';

export interface ArchiveLetterResult {
  success: boolean;
  documentId?: string;
  archivedAt?: string;
  archivedBy?: string;
  followUpTaskId?: string | null;
  error?: string;
}

/**
 * supabase-js meldet für jede Nicht-2xx-Antwort nur "Edge Function returned a
 * non-2xx status code". Die eigentliche Begründung steht im Antwortkörper der
 * Funktion und wird daraus gelesen, damit der Fehler zuordenbar bleibt.
 */
async function functionErrorMessage(error: unknown): Promise<string | undefined> {
  const context = (error as { context?: Response } | null | undefined)?.context;
  if (!context || typeof context.clone !== "function") return undefined;
  try {
    const body = (await context.clone().json()) as { error?: unknown; details?: unknown } | null;
    const parts = [body?.error, body?.details].filter((part): part is string => typeof part === "string" && part.length > 0);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Archiviert einen Brief über die Edge Function `archive-letter`.
 *
 * Der Mandant steht ausdrücklich im Rumpf: Der Mandanten-Guard des Clients setzt
 * den Arbeitsbereich nur als Header `x-tenant-id`, den die Funktion sonst allein
 * auswertet. Ohne diesen Header fällt sie auf "einzige Mitgliedschaft" zurück
 * oder antwortet mit 403 "Explicit tenant context required". Rumpf und Header
 * tragen jetzt denselben Wert, den `requireTenantAccess` gegeneinander prüft.
 */
export const archiveLetter = async (letterId: string, userId: string): Promise<ArchiveLetterResult> => {
  const tenantId = getActiveTenantScope()?.tenantId;
  try {
    const { data, error } = await supabase.functions.invoke('archive-letter', {
      body: tenantId ? { letterId, userId, tenant_id: tenantId } : { letterId, userId },
    });

    if (error) {
      throw error;
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Die Archivierung konnte nicht abgeschlossen werden.',
      };
    }

    return {
      success: true,
      documentId: data.documentId,
      archivedAt: data.archivedAt,
      archivedBy: data.archivedBy,
      followUpTaskId: data.followUpTaskId ?? null,
    };
  } catch (error: unknown) {
    debugConsole.error('Error archiving letter:', error);
    const message = error instanceof Error && error.message
      ? error.message
      : 'Die Archivierung konnte nicht abgeschlossen werden.';
    const detail = await functionErrorMessage(error);
    return { success: false, error: detail ? `${message}: ${detail}` : message };
  }
};

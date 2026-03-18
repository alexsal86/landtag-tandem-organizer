import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from '@/integrations/supabase/types';

type DecisionInsert = Database['public']['Tables']['task_decisions']['Insert'];
type DecisionParticipantInsert = Database['public']['Tables']['task_decision_participants']['Insert'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

type LetterApprovalResponseOption = {
  label: string;
  value: 'approve' | 'reject';
};

const LETTER_APPROVAL_OPTIONS: LetterApprovalResponseOption[] = [
  { label: 'Freigeben', value: 'approve' },
  { label: 'Zurückweisen', value: 'reject' },
];

export async function createLetterApprovalDecision(
  letterId: string,
  letterTitle: string,
  createdByUserId: string,
  reviewerUserId: string,
  tenantId: string,
): Promise<string | null> {
  try {
    const decisionPayload: DecisionInsert = {
      created_by: createdByUserId,
      title: `Brief freigeben: ${letterTitle}`,
      description: `Bitte prüfen und freigeben Sie den Brief "${letterTitle}".\n\nÖffnen Sie den Brief in der Dokumentenverwaltung, um ihn zu lesen.`,
      status: 'open',
      tenant_id: tenantId,
      response_options: LETTER_APPROVAL_OPTIONS,
      visible_to_all: false,
    };

    const { data: decision, error: decisionError } = await supabase
      .from('task_decisions')
      .insert([decisionPayload])
      .select('id')
      .single<{ id: string }>();

    if (decisionError) {
      debugConsole.error('Error creating approval decision:', decisionError);
      return null;
    }

    if (decision?.id) {
      const participantPayload: DecisionParticipantInsert = {
        decision_id: decision.id,
        user_id: reviewerUserId,
      };

      const { error: participantError } = await supabase
        .from('task_decision_participants')
        .insert([participantPayload]);

      if (participantError) {
        debugConsole.error('Error adding decision participant:', participantError);
      }
    }

    return decision?.id ?? null;
  } catch (error: unknown) {
    debugConsole.error('Error in createLetterApprovalDecision:', error);
    return null;
  }
}

export async function createLetterSendTask(
  letterTitle: string,
  assignedToUserId: string,
  createdByUserId: string,
  tenantId: string,
): Promise<void> {
  try {
    const taskPayload: TaskInsert = {
      title: `Brief versenden: ${letterTitle}`,
      description: `Der Brief "${letterTitle}" wurde freigegeben und kann jetzt versendet werden.`,
      status: 'to-do',
      priority: 'medium',
      category: 'briefe',
      assigned_to: assignedToUserId,
      user_id: createdByUserId,
      tenant_id: tenantId,
    };

    await supabase.from('tasks').insert([taskPayload]);
  } catch (error: unknown) {
    debugConsole.error('Error creating send task:', error);
  }
}

export async function createLetterRevisionTask(
  letterTitle: string,
  revisionComment: string,
  creatorUserId: string,
  reviewerUserId: string,
  tenantId: string,
): Promise<void> {
  try {
    const assignedTo = creatorUserId === reviewerUserId
      ? creatorUserId
      : `{${creatorUserId},${reviewerUserId}}`;

    const taskPayload: TaskInsert = {
      title: `Brief überarbeiten: ${letterTitle}`,
      description: revisionComment
        ? `Begründung der Zurückweisung:\n\n${revisionComment}`
        : `Der Brief "${letterTitle}" wurde zur Überarbeitung zurückgewiesen.`,
      status: 'to-do',
      priority: 'high',
      category: 'briefe',
      assigned_to: assignedTo,
      user_id: reviewerUserId,
      tenant_id: tenantId,
    };

    await supabase.from('tasks').insert([taskPayload]);
  } catch (error: unknown) {
    debugConsole.error('Error creating revision task:', error);
  }
}

import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import type { Database } from '@/integrations/supabase/types';
import { serializeLegacyTaskAssignees } from '@/lib/taskAssignees';

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

const LETTER_TASK_STATUS = 'todo';
const LETTER_TASK_CATEGORY = 'personal';
const VALID_TASK_STATUSES = new Set(['todo', 'in-progress', 'completed']);
const VALID_TASK_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_TASK_CATEGORIES = new Set(['personal', 'meeting', 'call_follow_up', 'call_followup']);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function assertValidLetterTaskPayload(taskPayload: TaskInsert): void {
  if (!isNonEmptyString(taskPayload.title)) {
    throw new Error('Letter workflow task payload requires a title.');
  }

  if (!isNonEmptyString(taskPayload.user_id)) {
    throw new Error('Letter workflow task payload requires a creator user_id.');
  }

  if (!isNonEmptyString(taskPayload.tenant_id)) {
    throw new Error('Letter workflow task payload requires a tenant_id.');
  }

  if (!VALID_TASK_STATUSES.has(taskPayload.status ?? '')) {
    throw new Error(`Invalid task status for letter workflow: ${taskPayload.status ?? 'undefined'}`);
  }

  if (!VALID_TASK_PRIORITIES.has(taskPayload.priority ?? '')) {
    throw new Error(`Invalid task priority for letter workflow: ${taskPayload.priority ?? 'undefined'}`);
  }

  if (!VALID_TASK_CATEGORIES.has(taskPayload.category ?? '')) {
    throw new Error(`Invalid task category for letter workflow: ${taskPayload.category ?? 'undefined'}`);
  }
}

export function buildLetterSendTaskPayload(
  letterTitle: string,
  assignedToUserId: string,
  createdByUserId: string,
  tenantId: string,
): TaskInsert {
  const taskPayload = {
    title: `Brief versenden: ${letterTitle}`,
    description: `Der Brief "${letterTitle}" wurde freigegeben und kann jetzt versendet werden.`,
    status: LETTER_TASK_STATUS,
    priority: 'medium',
    category: LETTER_TASK_CATEGORY,
    assigned_to: serializeLegacyTaskAssignees([assignedToUserId]) ?? assignedToUserId,
    user_id: createdByUserId,
    tenant_id: tenantId,
  } satisfies TaskInsert;

  assertValidLetterTaskPayload(taskPayload);

  return taskPayload;
}

export function buildLetterRevisionTaskPayload(
  letterTitle: string,
  revisionComment: string,
  creatorUserId: string,
  reviewerUserId: string,
  tenantId: string,
): TaskInsert {
  const assignedTo = serializeLegacyTaskAssignees(
    creatorUserId === reviewerUserId
      ? [creatorUserId]
      : [creatorUserId, reviewerUserId],
  );

  const taskPayload = {
    title: `Brief überarbeiten: ${letterTitle}`,
    description: revisionComment
      ? `Begründung der Zurückweisung:\n\n${revisionComment}`
      : `Der Brief "${letterTitle}" wurde zur Überarbeitung zurückgewiesen.`,
    status: LETTER_TASK_STATUS,
    priority: 'high',
    category: LETTER_TASK_CATEGORY,
    assigned_to: assignedTo,
    user_id: reviewerUserId,
    tenant_id: tenantId,
  } satisfies TaskInsert;

  assertValidLetterTaskPayload(taskPayload);

  return taskPayload;
}

export async function createLetterApprovalDecision(
  letterId: string,
  letterTitle: string,
  createdByUserId: string,
  reviewerUserId: string,
  tenantId: string,
  letterContent?: {
    contentHtml?: string;
    salutation?: string;
    closingFormula?: string;
    closingName?: string;
    subject?: string;
  },
): Promise<string | null> {
  try {
    // Build a rich description with the full letter text
    const descriptionParts: string[] = [];
    descriptionParts.push(`Bitte prüfen und freigeben Sie den Brief "${letterTitle}".`);
    descriptionParts.push('');

    if (letterContent?.subject) {
      descriptionParts.push(`**Betreff:** ${letterContent.subject}`);
      descriptionParts.push('');
    }

    if (letterContent?.salutation) {
      descriptionParts.push(letterContent.salutation);
      descriptionParts.push('');
    }

    if (letterContent?.contentHtml) {
      descriptionParts.push(letterContent.contentHtml);
      descriptionParts.push('');
    }

    if (letterContent?.closingFormula) {
      descriptionParts.push(letterContent.closingFormula);
    }
    if (letterContent?.closingName) {
      descriptionParts.push(letterContent.closingName);
    }

    // Embed letter_id as a marker for auto-processing
    descriptionParts.push('');
    descriptionParts.push(`letter_approval_letter_id:${letterId}`);

    const decisionPayload: DecisionInsert = {
      created_by: createdByUserId,
      title: `Brief freigeben: ${letterTitle}`,
      description: descriptionParts.join('\n'),
      status: 'open',
      tenant_id: tenantId,
      response_options: LETTER_APPROVAL_OPTIONS,
      visible_to_all: false,
    };

    const { data: decision, error: decisionError } = await supabase
      .from('task_decisions')
      .insert([decisionPayload])
      .select('id')
      .single();

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
    const taskPayload = buildLetterSendTaskPayload(
      letterTitle,
      assignedToUserId,
      createdByUserId,
      tenantId,
    );

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
    const taskPayload = buildLetterRevisionTaskPayload(
      letterTitle,
      revisionComment,
      creatorUserId,
      reviewerUserId,
      tenantId,
    );

    await supabase.from('tasks').insert([taskPayload]);
  } catch (error: unknown) {
    debugConsole.error('Error creating revision task:', error);
  }
}

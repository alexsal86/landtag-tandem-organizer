import { supabase } from '@/integrations/supabase/client';

/**
 * Creates a decision for letter approval when transitioning to pending_approval.
 */
export async function createLetterApprovalDecision(
  letterId: string,
  letterTitle: string,
  createdByUserId: string,
  reviewerUserId: string,
  tenantId: string
): Promise<string | null> {
  try {
    // Create the decision
    const { data: decision, error: decisionError } = await supabase
      .from('task_decisions')
      .insert({
        created_by: createdByUserId,
        title: `Brief freigeben: ${letterTitle}`,
        description: `Bitte prüfen und freigeben Sie den Brief "${letterTitle}".\n\nÖffnen Sie den Brief in der Dokumentenverwaltung, um ihn zu lesen.`,
        status: 'open',
        tenant_id: tenantId,
        response_options: JSON.parse(JSON.stringify([
          { label: 'Freigeben', value: 'approve' },
          { label: 'Zurückweisen', value: 'reject' }
        ])),
        visible_to_all: false,
      })
      .select('id')
      .single();

    if (decisionError) {
      console.error('Error creating approval decision:', decisionError);
      return null;
    }

    // Add reviewer as participant
    if (decision?.id) {
      const { error: participantError } = await supabase
        .from('task_decision_participants')
        .insert({
          decision_id: decision.id,
          user_id: reviewerUserId,
        });

      if (participantError) {
        console.error('Error adding decision participant:', participantError);
      }
    }

    return decision?.id || null;
  } catch (error) {
    console.error('Error in createLetterApprovalDecision:', error);
    return null;
  }
}

/**
 * Creates a task when a letter is approved (assigned to letter creator).
 */
export async function createLetterSendTask(
  letterTitle: string,
  assignedToUserId: string,
  createdByUserId: string,
  tenantId: string
): Promise<void> {
  try {
    await supabase
      .from('tasks')
      .insert({
        title: `Brief versenden: ${letterTitle}`,
        description: `Der Brief "${letterTitle}" wurde freigegeben und kann jetzt versendet werden.`,
        status: 'to-do',
        priority: 'medium',
        category: 'briefe',
        assigned_to: assignedToUserId,
        user_id: createdByUserId,
        tenant_id: tenantId,
      });
  } catch (error) {
    console.error('Error creating send task:', error);
  }
}

/**
 * Creates a task when a letter is rejected (assigned to creator AND reviewer).
 */
export async function createLetterRevisionTask(
  letterTitle: string,
  revisionComment: string,
  creatorUserId: string,
  reviewerUserId: string,
  tenantId: string
): Promise<void> {
  try {
    // Create task assigned to both creator and reviewer
    const assignedTo = creatorUserId === reviewerUserId 
      ? creatorUserId 
      : `{${creatorUserId},${reviewerUserId}}`;

    await supabase
      .from('tasks')
      .insert({
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
      });
  } catch (error) {
    console.error('Error creating revision task:', error);
  }
}

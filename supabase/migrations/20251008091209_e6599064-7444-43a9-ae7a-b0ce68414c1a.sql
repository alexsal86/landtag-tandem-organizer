-- Migration: Add creator as participant for public decisions without participants
-- This ensures all existing public decisions have at least one participant (the creator)

-- Insert creator as participant for all public decisions that currently have no participants
INSERT INTO public.task_decision_participants (decision_id, user_id)
SELECT 
  td.id as decision_id,
  td.created_by as user_id
FROM public.task_decisions td
WHERE td.visible_to_all = true
  AND td.status = 'open'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.task_decision_participants tdp 
    WHERE tdp.decision_id = td.id
  )
  -- Extra safety: ensure creator is not already a participant
  AND NOT EXISTS (
    SELECT 1
    FROM public.task_decision_participants tdp2
    WHERE tdp2.decision_id = td.id 
      AND tdp2.user_id = td.created_by
  );
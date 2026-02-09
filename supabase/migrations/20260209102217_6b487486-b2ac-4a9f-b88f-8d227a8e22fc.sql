-- Fix Issue 1: Disable auto-archiving triggers
-- Decisions should remain active until manually archived by the creator.
-- The visual "Entschieden" badge already indicates completion.

-- Remove the trigger that auto-archives after all participants respond
DROP TRIGGER IF EXISTS trigger_auto_archive_decisions ON public.task_decision_responses;

-- Remove the trigger that auto-archives after creator responds to a question
DROP TRIGGER IF EXISTS trigger_check_archive_on_creator_response ON public.task_decision_responses;

-- Note: The underlying functions (auto_archive_completed_decisions, 
-- check_archive_after_creator_response, check_and_archive_decision) 
-- are kept for potential future use but will no longer be automatically invoked.
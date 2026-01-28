import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface NewCounts {
  tasks: number;
  decisions: number;
  jourFixe: number;
  caseFiles: number;
  plannings: number;
}

interface LastVisits {
  mywork_tasks?: Date;
  mywork_decisions?: Date;
  mywork_jourFixe?: Date;
  mywork_casefiles?: Date;
  mywork_plannings?: Date;
}

const CONTEXTS = [
  'mywork_tasks',
  'mywork_decisions',
  'mywork_jourFixe',
  'mywork_casefiles',
  'mywork_plannings',
] as const;

type ContextType = typeof CONTEXTS[number];

interface MyWorkNewCountsResult {
  newCounts: NewCounts;
  isLoading: boolean;
  markTabAsVisited: (context: ContextType) => Promise<void>;
  refreshCounts: () => Promise<void>;
}

export function useMyWorkNewCounts(): MyWorkNewCountsResult {
  const { user } = useAuth();
  const [newCounts, setNewCounts] = useState<NewCounts>({
    tasks: 0,
    decisions: 0,
    jourFixe: 0,
    caseFiles: 0,
    plannings: 0,
  });
  const [lastVisits, setLastVisits] = useState<LastVisits>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load last visited timestamps for all mywork contexts
  const loadLastVisits = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_navigation_visits')
        .select('navigation_context, last_visited_at')
        .eq('user_id', user.id)
        .in('navigation_context', CONTEXTS);

      if (error) {
        console.error('Error loading last visits:', error);
        return;
      }

      const visits: LastVisits = {};
      (data || []).forEach((row) => {
        visits[row.navigation_context as ContextType] = new Date(row.last_visited_at);
      });
      setLastVisits(visits);
    } catch (error) {
      console.error('Error in loadLastVisits:', error);
    }
  }, [user]);

  // Count new items for each tab based on last visit
  const loadNewCounts = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const tasksLastVisit = lastVisits.mywork_tasks?.toISOString() || new Date(0).toISOString();
      const decisionsLastVisit = lastVisits.mywork_decisions?.toISOString() || new Date(0).toISOString();
      const jourFixeLastVisit = lastVisits.mywork_jourFixe?.toISOString() || new Date(0).toISOString();
      const caseFilesLastVisit = lastVisits.mywork_casefiles?.toISOString() || new Date(0).toISOString();
      const planningsLastVisit = lastVisits.mywork_plannings?.toISOString() || new Date(0).toISOString();

      // Count new tasks (created after last visit, assigned to user or created by user)
      const { count: newTaskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .or(`assigned_to.cs.{${user.id}},user_id.eq.${user.id}`)
        .neq('status', 'completed')
        .gt('created_at', tasksLastVisit);

      // Count new decision requests (participant added after last visit)
      const { count: newDecisionRequestCount } = await supabase
        .from('task_decision_participants')
        .select('*, task_decisions!inner(*)', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('task_decisions.status', ['active', 'open'])
        .gt('created_at', decisionsLastVisit);

      // Count new responses to user's own decisions
      const { data: userDecisions } = await supabase
        .from('task_decisions')
        .select('id')
        .eq('created_by', user.id)
        .in('status', ['active', 'open']);

      let newResponseCount = 0;
      if (userDecisions && userDecisions.length > 0) {
        const decisionIds = userDecisions.map(d => d.id);
        const { count } = await supabase
          .from('task_decision_responses')
          .select('*, task_decision_participants!inner(decision_id)', { count: 'exact', head: true })
          .in('task_decision_participants.decision_id', decisionIds)
          .gt('created_at', decisionsLastVisit);
        newResponseCount = count || 0;
      }

      // Count new Jour Fixe meetings (user is owner or participant, created after last visit)
      const { count: newJourFixeCount } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'archived')
        .gt('created_at', jourFixeLastVisit);

      // Check for meetings where user was added as participant after last visit
      const { count: newParticipantMeetingCount } = await supabase
        .from('meeting_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('created_at', jourFixeLastVisit);

      // Count new case files
      const { count: newCaseFileCount } = await supabase
        .from('case_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('created_at', caseFilesLastVisit);

      // Count new plannings (owned)
      const { count: newOwnedPlanningCount } = await supabase
        .from('event_plannings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('created_at', planningsLastVisit);

      // Count plannings where user was added as collaborator after last visit
      const { count: newCollabPlanningCount } = await supabase
        .from('event_planning_collaborators')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('created_at', planningsLastVisit);

      setNewCounts({
        tasks: newTaskCount || 0,
        decisions: (newDecisionRequestCount || 0) + newResponseCount,
        jourFixe: (newJourFixeCount || 0) + (newParticipantMeetingCount || 0),
        caseFiles: newCaseFileCount || 0,
        plannings: (newOwnedPlanningCount || 0) + (newCollabPlanningCount || 0),
      });
    } catch (error) {
      console.error('Error loading new counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, lastVisits]);

  // Mark a tab as visited (update last_visited_at)
  const markTabAsVisited = useCallback(async (context: ContextType) => {
    if (!user) return;

    try {
      const now = new Date();
      
      // Upsert the visit record
      await supabase
        .from('user_navigation_visits')
        .upsert({
          user_id: user.id,
          navigation_context: context,
          last_visited_at: now.toISOString(),
        }, { onConflict: 'user_id,navigation_context' });

      // Update local state
      setLastVisits(prev => ({
        ...prev,
        [context]: now,
      }));

      // Reset the count for this tab
      const contextToCountKey: Record<ContextType, keyof NewCounts> = {
        mywork_tasks: 'tasks',
        mywork_decisions: 'decisions',
        mywork_jourFixe: 'jourFixe',
        mywork_casefiles: 'caseFiles',
        mywork_plannings: 'plannings',
      };

      const countKey = contextToCountKey[context];
      if (countKey) {
        setNewCounts(prev => ({
          ...prev,
          [countKey]: 0,
        }));
      }

      // Sync across tabs
      localStorage.setItem('navigation_visit_sync', JSON.stringify({
        userId: user.id,
        context,
        timestamp: now.toISOString(),
      }));
    } catch (error) {
      console.error('Error marking tab as visited:', error);
    }
  }, [user]);

  // Load last visits first
  useEffect(() => {
    loadLastVisits();
  }, [loadLastVisits]);

  // Load new counts after last visits are loaded
  useEffect(() => {
    if (Object.keys(lastVisits).length > 0 || !isLoading) {
      loadNewCounts();
    }
  }, [lastVisits, loadNewCounts]);

  // Refresh function for external use
  const refreshCounts = useCallback(async () => {
    await loadLastVisits();
    await loadNewCounts();
  }, [loadLastVisits, loadNewCounts]);

  return {
    newCounts,
    isLoading,
    markTabAsVisited,
    refreshCounts,
  };
}

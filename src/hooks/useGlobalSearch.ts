import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";

export interface GlobalSearchFilters {
  dateFrom: string;
  dateTo: string;
  category: string;
  status: string;
}

const DEFAULT_FILTERS: GlobalSearchFilters = {
  dateFrom: "",
  dateTo: "",
  category: "",
  status: "",
};

interface UseGlobalSearchOptions {
  query: string;
  filters?: GlobalSearchFilters;
  enabled?: boolean;
  debounceMs?: number;
  minQueryLength?: number;
}

export function useGlobalSearch({
  query,
  filters = DEFAULT_FILTERS,
  enabled = true,
  debounceMs = 500,
  minQueryLength = 2,
}: UseGlobalSearchOptions) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedQuery(query), debounceMs);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, debounceMs]);

  const queryEnabled = enabled && !!currentTenant?.id && debouncedQuery.length >= minQueryLength;

  const contactsQuery = useQuery({
    queryKey: ["global-search-contacts", debouncedQuery, currentTenant?.id, filters],
    queryFn: async () => {
      let dbQuery = supabase
        .from("contacts")
        .select("id, name, organization, avatar_url, category, company, email, phone, mobile_phone, role, position")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`name.ilike.%${debouncedQuery}%,organization.ilike.%${debouncedQuery}%,company.ilike.%${debouncedQuery}%,email.ilike.%${debouncedQuery}%,phone.ilike.%${debouncedQuery}%,mobile_phone.ilike.%${debouncedQuery}%,role.ilike.%${debouncedQuery}%,position.ilike.%${debouncedQuery}%`);

      if (filters.category) dbQuery = dbQuery.eq("category", filters.category);

      const { data, error } = await dbQuery.limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const appointmentsQuery = useQuery({
    queryKey: ["global-search-appointments", debouncedQuery, currentTenant?.id, filters],
    queryFn: async () => {
      let dbQuery = supabase
        .from("appointments")
        .select("id, title, start_time, location, category, description, meeting_details")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,location.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,meeting_details.ilike.%${debouncedQuery}%`);

      if (filters.dateFrom) dbQuery = dbQuery.gte("start_time", filters.dateFrom);
      if (filters.dateTo) dbQuery = dbQuery.lte("start_time", filters.dateTo);
      if (filters.category) dbQuery = dbQuery.eq("category", filters.category);

      const { data, error } = await dbQuery
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const tasksQuery = useQuery({
    queryKey: ["global-search-tasks", debouncedQuery, currentTenant?.id, filters],
    queryFn: async () => {
      let dbQuery = supabase
        .from("tasks")
        .select("id, title, due_date, status, priority, category")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%,status.ilike.%${debouncedQuery}%`);

      if (filters.status && filters.status !== "completed") {
        dbQuery = dbQuery.eq("status", filters.status);
      } else if (!filters.status) {
        dbQuery = dbQuery.neq("status", "completed");
      }

      if (filters.dateFrom) dbQuery = dbQuery.gte("due_date", filters.dateFrom);
      if (filters.dateTo) dbQuery = dbQuery.lte("due_date", filters.dateTo);

      const { data, error } = await dbQuery.order("due_date", { ascending: true }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const documentsQuery = useQuery({
    queryKey: ["global-search-documents", debouncedQuery, currentTenant?.id, filters],
    queryFn: async () => {
      let dbQuery = supabase
        .from("documents")
        .select("id, title, description, category, status, file_name, document_type, file_type, tags")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,file_name.ilike.%${debouncedQuery}%,document_type.ilike.%${debouncedQuery}%,file_type.ilike.%${debouncedQuery}%`);

      if (filters.category) dbQuery = dbQuery.eq("category", filters.category);
      if (filters.status) dbQuery = dbQuery.eq("status", filters.status);

      const { data, error } = await dbQuery.order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const lettersQuery = useQuery({
    queryKey: ["global-search-letters", debouncedQuery, currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letters")
        .select("id, title, recipient_name, letter_date, subject, subject_line, reference_number")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,recipient_name.ilike.%${debouncedQuery}%,subject.ilike.%${debouncedQuery}%,subject_line.ilike.%${debouncedQuery}%,reference_number.ilike.%${debouncedQuery}%`)
        .order("letter_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const protocolsQuery = useQuery({
    queryKey: ["global-search-protocols", debouncedQuery, currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, description, location")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,location.ilike.%${debouncedQuery}%`)
        .order("meeting_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const caseFilesQuery = useQuery({
    queryKey: ["global-search-casefiles", debouncedQuery, currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_files")
        .select("id, title, reference_number, status, case_type, tags, current_status_note, processing_status, priority")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,reference_number.ilike.%${debouncedQuery}%,current_status_note.ilike.%${debouncedQuery}%,case_type.ilike.%${debouncedQuery}%,processing_status.ilike.%${debouncedQuery}%,status.ilike.%${debouncedQuery}%,priority.ilike.%${debouncedQuery}%`)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const archivedTasksQuery = useQuery({
    queryKey: ["global-search-archived-tasks", debouncedQuery, currentTenant?.id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("archived_tasks")
        .select("id, title, description, completed_at, category, priority")
        .eq("user_id", user?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%,priority.ilike.%${debouncedQuery}%`)
        .order("archived_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled && !!user?.id,
  });

  const decisionsQuery = useQuery({
    queryKey: ["global-search-decisions", debouncedQuery, currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_decisions")
        .select("id, title, description, status, priority, archived_at, updated_at")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,status.ilike.%${debouncedQuery}%`)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const planningsQuery = useQuery({
    queryKey: ["global-search-plannings", debouncedQuery, currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_plannings")
        .select("id, title, description, location, contact_person, is_archived, archived_at, updated_at")
        .eq("tenant_id", currentTenant?.id ?? "")
        .or(`title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,location.ilike.%${debouncedQuery}%,contact_person.ilike.%${debouncedQuery}%`)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  const contacts = contactsQuery.data || [];
  const appointments = appointmentsQuery.data || [];
  const tasks = tasksQuery.data || [];
  const documents = documentsQuery.data || [];
  const letters = lettersQuery.data || [];
  const protocols = protocolsQuery.data || [];
  const caseFiles = caseFilesQuery.data || [];
  const archivedTasks = archivedTasksQuery.data || [];
  const decisions = decisionsQuery.data || [];
  const plannings = planningsQuery.data || [];

  const activeDecisions = useMemo(() => decisions.filter((decision) => !decision.archived_at), [decisions]);
  const archivedDecisions = useMemo(() => decisions.filter((decision) => !!decision.archived_at), [decisions]);
  const activePlannings = useMemo(() => plannings.filter((planning) => !planning.archived_at && !planning.is_archived), [plannings]);
  const archivedPlannings = useMemo(() => plannings.filter((planning) => !!planning.archived_at || !!planning.is_archived), [plannings]);

  const isLoading = query !== debouncedQuery || [
    contactsQuery,
    appointmentsQuery,
    tasksQuery,
    documentsQuery,
    lettersQuery,
    protocolsQuery,
    caseFilesQuery,
    archivedTasksQuery,
    decisionsQuery,
    planningsQuery,
  ].some((searchQueryResult) => searchQueryResult.isLoading || searchQueryResult.isFetching);

  const firstError = [
    contactsQuery.error,
    appointmentsQuery.error,
    tasksQuery.error,
    documentsQuery.error,
    lettersQuery.error,
    protocolsQuery.error,
    caseFilesQuery.error,
    archivedTasksQuery.error,
    decisionsQuery.error,
    planningsQuery.error,
  ].find(Boolean);

  const resultCount =
    contacts.length +
    appointments.length +
    tasks.length +
    documents.length +
    letters.length +
    protocols.length +
    caseFiles.length +
    archivedTasks.length +
    activeDecisions.length +
    archivedDecisions.length +
    activePlannings.length +
    archivedPlannings.length;

  const resultTypes: string[] = [];
  if (contacts.length) resultTypes.push("contacts");
  if (appointments.length) resultTypes.push("appointments");
  if (tasks.length) resultTypes.push("tasks");
  if (documents.length) resultTypes.push("documents");
  if (letters.length) resultTypes.push("letters");
  if (protocols.length) resultTypes.push("protocols");
  if (caseFiles.length) resultTypes.push("casefiles");
  if (archivedTasks.length) resultTypes.push("archived_tasks");
  if (activeDecisions.length) resultTypes.push("decisions");
  if (archivedDecisions.length) resultTypes.push("archived_decisions");
  if (activePlannings.length) resultTypes.push("plannings");
  if (archivedPlannings.length) resultTypes.push("archived_plannings");

  return {
    debouncedQuery,
    contacts,
    appointments,
    tasks,
    documents,
    letters,
    protocols,
    caseFiles,
    archivedTasks,
    activeDecisions,
    archivedDecisions,
    activePlannings,
    archivedPlannings,
    isLoading,
    isError: Boolean(firstError),
    error: firstError,
    hasResults: resultCount > 0,
    resultCount,
    resultTypes,
  };
}

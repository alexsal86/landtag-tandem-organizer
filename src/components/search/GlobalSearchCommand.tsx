import { openKnowledgeQuestion } from "@/features/knowledge/globalQuestion";
import { useActionPermission } from "@/hooks/useActionPermission";
import { MessageCircleQuestion } from "lucide-react";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useIsFetching, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Filter, RefreshCw, TrendingUp, X } from "lucide-react";
import { 
  User, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Mail, 
  FileSignature,
  Users,
  Vote,
  CalendarPlus,
  Briefcase
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildOrIlikeFilter } from "./postgrestSearch";
import { buildSearchHref } from "@/lib/appTargets";
import { STALE_TIME } from "@/lib/query-cache";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
// debounce no longer needed - using direct state updates
import { format } from "date-fns";
import { de } from "date-fns/locale";

// Recent searches management
const RECENT_SEARCHES_KEY = 'global-search-recent';
const MAX_RECENT_SEARCHES = 5;

interface RecentSearch {
  query: string;
  timestamp: number;
}

const getRecentSearches = (): RecentSearch[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addRecentSearch = (query: string) => {
  const recent = getRecentSearches();
  const filtered = recent.filter(s => s.query !== query);
  const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
};

const clearRecentSearches = () => {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
};

type FilterScope = "all" | "contacts" | "appointments" | "tasks" | "documents";

const FILTER_SCOPES: { value: FilterScope; label: string }[] = [
  { value: "all", label: "Alle Bereiche" },
  { value: "contacts", label: "Kontakte" },
  { value: "appointments", label: "Termine" },
  { value: "tasks", label: "Aufgaben" },
  { value: "documents", label: "Dokumente" },
];

/** Alle Suchabfragen teilen sich diesen Schlüssel-Präfix. */
const isGlobalSearchQueryKey = (queryKey: readonly unknown[]): boolean =>
  typeof queryKey[0] === "string" && queryKey[0].startsWith("global-search-");

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    dateFrom: string;
    dateTo: string;
    category: string;
    status: string;
    scope: FilterScope;
  }>({
    dateFrom: "",
    dateTo: "",
    category: "",
    status: "",
    scope: "all",
  });
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { allowed: canAskKnowledge } = useActionPermission("knowledge.write");
  const queryClient = useQueryClient();
  const fetchingSearchQueries = useIsFetching({
    predicate: (query) => isGlobalSearchQueryKey(query.queryKey),
  });
  const retrySearch = useCallback(() => {
    void queryClient.refetchQueries({
      predicate: (query) => isGlobalSearchQueryKey(query.queryKey),
    });
  }, [queryClient]);

  // Debounce search query to avoid firing 12 queries on every keystroke
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  // Load recent searches
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    }
  }, [open]);

  // Keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Custom event listener for programmatic opening (with optional initial query)
  useEffect(() => {
    const handleOpenSearch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOpen(true);

      if (detail?.query) {
        // Set both searchQuery and debouncedQuery immediately to avoid waiting for debounce
        setSearchQuery(detail.query);
        setDebouncedQuery(detail.query);
        // Clear any pending debounce timer
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      }
    };
    window.addEventListener('openGlobalSearch', handleOpenSearch);
    return () => window.removeEventListener('openGlobalSearch', handleOpenSearch);
  }, []);

  // Track search analytics
  const trackSearchMutation = useMutation({
    mutationFn: async ({ query, resultCount, resultTypes }: { 
      query: string; 
      resultCount: number; 
      resultTypes: string[] 
    }) => {
      if (!user || !currentTenant) return;
      await supabase.from('search_analytics').insert([{
        user_id: user.id,
        tenant_id: currentTenant.id,
        search_query: query,
        result_count: resultCount,
        result_types: resultTypes
      }]);
    }
  });

  // Get popular searches
  const { data: popularSearches } = useQuery({
    queryKey: ['popular-searches', currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('search_analytics')
        .select('search_query, result_count')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error || !data) return [];
      
      // Count occurrences and sort by frequency
      const counts = data.reduce((acc, item) => {
        acc[item.search_query] = (acc[item.search_query] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(counts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([query]) => query);
    },
    enabled: !!currentTenant?.id && open
  });

  // Search queries with fuzzy search - all use debouncedQuery to prevent firing on every keystroke
  const {
    data: contacts,
    isLoading: contactsLoading,
    error: contactsError,
  } = useQuery({
    queryKey: ['global-search-contacts', debouncedQuery, currentTenant?.id, filters],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      let query = supabase
        .from('contacts')
        .select('id, name, organization, avatar_url, category, email, phone, mobile_phone, position')
        .eq('tenant_id', currentTenant?.id ?? '');
      
      // Fuzzy search using pg_trgm similarity
      query = query.or(buildOrIlikeFilter(["name", "organization", "email", "phone", "mobile_phone", "position"], debouncedQuery));
      
      // Kategorien sind je Bereich unterschiedlich benannt; der Filter gilt nur im
      // gewählten Bereich und nie für fremde Vokabulare.
      if (filters.scope === "contacts" && filters.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: appointments,
    isLoading: appointmentsLoading,
    error: appointmentsError,
  } = useQuery({
    queryKey: ['global-search-appointments', debouncedQuery, currentTenant?.id, filters],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      let query = supabase
        .from('appointments')
        .select('id, title, start_time, location, category, description, meeting_details')
        .eq('tenant_id', currentTenant?.id ?? '')
        .or(buildOrIlikeFilter(["title", "location", "description", "meeting_details"], debouncedQuery));
      
      if (filters.dateFrom) {
        query = query.gte('start_time', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('start_time', `${filters.dateTo}T23:59:59`);
      }
      if (filters.scope === "appointments" && filters.category) {
        query = query.eq('category', filters.category);
      }

      // Bewusst keine "ab jetzt"-Grenze: die globale Suche muss auch vergangene
      // Termine finden. Der Zeitraum ergibt sich allein aus den Datumsfiltern.
      const { data, error } = await query
        .order('start_time', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useQuery({
    queryKey: ['global-search-tasks', debouncedQuery, currentTenant?.id, filters],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      let query = supabase
        .from('tasks')
        .select('id, title, due_date, status, priority, category')
        .eq('tenant_id', currentTenant?.id ?? '')
        .or(buildOrIlikeFilter(["title", "description", "category", "status"], debouncedQuery));
      
      // Ein ausdrücklich gesetzter Status (auch "completed") gilt immer; ohne
      // Statusfilter bleiben abgeschlossene Aufgaben wie bisher außen vor.
      if (filters.scope === "tasks" && filters.status) {
        query = query.eq('status', filters.status);
      } else if (!filters.status) {
        query = query.neq('status', 'completed');
      }
      
      if (filters.dateFrom) {
        query = query.gte('due_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('due_date', filters.dateTo);
      }
      
      const { data, error } = await query
        .order('due_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: documents,
    isLoading: documentsLoading,
    error: documentsError,
  } = useQuery({
    queryKey: ['global-search-documents', debouncedQuery, currentTenant?.id, filters],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      let query = supabase
        .from('documents')
        .select('id, title, description, category, status, file_name, document_type, file_type, tags')
        .eq('tenant_id', currentTenant?.id ?? '')
        .or(buildOrIlikeFilter(["title", "description", "file_name", "document_type", "file_type"], debouncedQuery));
      
      if (filters.scope === "documents" && filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.scope === "documents" && filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: letters,
    isLoading: lettersLoading,
    error: lettersError,
  } = useQuery({
    queryKey: ['global-search-letters', debouncedQuery, currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('letters')
        .select('id, title, recipient_name, letter_date, subject, subject_line, reference_number')
        .eq('tenant_id', currentTenant?.id ?? '')
        .or(buildOrIlikeFilter(["title", "recipient_name", "subject", "subject_line", "reference_number"], debouncedQuery))
        .order('letter_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: protocols,
    isLoading: protocolsLoading,
    error: protocolsError,
  } = useQuery({
    queryKey: ['global-search-protocols', debouncedQuery, currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, description, location')
        .eq('tenant_id', currentTenant?.id ?? '')
        .or(buildOrIlikeFilter(["title", "description", "location"], debouncedQuery))
        .order('meeting_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: caseFiles,
    isLoading: caseFilesLoading,
    error: caseFilesError,
  } = useQuery({
    queryKey: ['global-search-casefiles', debouncedQuery, currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('case_files')
        .select('id, title, reference_number, status, case_type, tags, current_status_note, processing_status, priority')
        .eq('tenant_id', currentTenant?.id ?? '')
        .or(buildOrIlikeFilter(["title", "description", "reference_number", "current_status_note", "case_type", "processing_status", "status", "priority"], debouncedQuery))
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  // Search archived tasks
  const {
    data: archivedTasks,
    isLoading: archivedTasksLoading,
    error: archivedTasksError,
  } = useQuery({
    queryKey: ['global-search-archived-tasks', debouncedQuery, currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('archived_tasks')
        .select('id, title, description, completed_at, category, priority')
        .eq('user_id', user?.id ?? '')
        .or(buildOrIlikeFilter(["title", "description", "category", "priority"], debouncedQuery))
        .order('archived_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && !!user && debouncedQuery.length >= 2,
  });

  const {
    data: decisions,
    isLoading: decisionsLoading,
    error: decisionsError,
  } = useQuery({
    queryKey: ['global-search-decisions', debouncedQuery, currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('task_decisions')
        .select('id, title, description, status, priority, archived_at, updated_at')
        .eq('tenant_id', currentTenant!.id)
        .or(buildOrIlikeFilter(["title", "description", "status"], debouncedQuery))
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  const {
    data: plannings,
    isLoading: planningsLoading,
    error: planningsError,
  } = useQuery({
    queryKey: ['global-search-plannings', debouncedQuery, currentTenant?.id],
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('event_plannings')
        .select('id, title, description, location, contact_person, is_archived, archived_at, updated_at')
        .eq('tenant_id', currentTenant!.id)
        .or(buildOrIlikeFilter(["title", "description", "location", "contact_person"], debouncedQuery))
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!debouncedQuery && !!currentTenant?.id && debouncedQuery.length >= 2,
  });

  // Offen ist eine Entscheidung nur mit Status 'active'/'open' und ohne Archivstempel; der reine
  // Stempel-Check würde archivierte Datensätze ohne archived_at als offen anzeigen.
  const activeDecisions = useMemo(() => decisions?.filter((decision) =>
    !decision.archived_at && decision.status !== "archived") || [], [decisions]);
  const archivedDecisions = useMemo(() => decisions?.filter((decision) =>
    !!decision.archived_at || decision.status === "archived") || [], [decisions]);
  const activePlannings = useMemo(() => plannings?.filter((planning) => !planning.archived_at && !planning.is_archived) || [], [plannings]);
  const archivedPlannings = useMemo(() => plannings?.filter((planning) => !!planning.archived_at || !!planning.is_archived) || [], [plannings]);

  // Track search analytics only when all queries have settled and the debounced query is stable
  const isStillSearching = contactsLoading || appointmentsLoading || tasksLoading ||
    documentsLoading || lettersLoading || protocolsLoading || caseFilesLoading ||
    archivedTasksLoading || decisionsLoading || planningsLoading;

  // Fehlgeschlagene Quellen werden sichtbar gemacht, statt als "keine Treffer"
  // durchzugehen. Andere Bereiche zeigen ihre Ergebnisse weiterhin an.
  const searchErrors = [
    contactsError,
    appointmentsError,
    tasksError,
    documentsError,
    lettersError,
    protocolsError,
    caseFilesError,
    archivedTasksError,
    decisionsError,
    planningsError,
  ].filter((error): error is Error => Boolean(error));

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2 || isStillSearching) return;
    const resultCount = (contacts?.length || 0) + (appointments?.length || 0) +
                        (tasks?.length || 0) + (documents?.length || 0) +
                        (letters?.length || 0) + (protocols?.length || 0) +
                        (caseFiles?.length || 0) + (archivedTasks?.length || 0) +
                        activeDecisions.length + archivedDecisions.length +
                        activePlannings.length + archivedPlannings.length;
    const resultTypes: string[] = [];
    if (contacts?.length) resultTypes.push('contacts');
    if (appointments?.length) resultTypes.push('appointments');
    if (tasks?.length) resultTypes.push('tasks');
    if (documents?.length) resultTypes.push('documents');
    if (letters?.length) resultTypes.push('letters');
    if (protocols?.length) resultTypes.push('protocols');
    if (caseFiles?.length) resultTypes.push('casefiles');
    if (archivedTasks?.length) resultTypes.push('archived_tasks');
    if (activeDecisions.length) resultTypes.push('decisions');
    if (archivedDecisions.length) resultTypes.push('archived_decisions');
    if (activePlannings.length) resultTypes.push('plannings');
    if (archivedPlannings.length) resultTypes.push('archived_plannings');
    trackSearchMutation.mutate({ query: debouncedQuery, resultCount, resultTypes });
  }, [debouncedQuery, isStillSearching]);

  const runCommand = useCallback((command: () => void) => {
    if (searchQuery && searchQuery.length >= 2) {
      addRecentSearch(searchQuery);
    }
    setOpen(false);
    setSearchQuery("");
    setFilters({ dateFrom: "", dateTo: "", category: "", status: "", scope: "all" });
    command();
  }, [searchQuery]);

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", category: "", status: "", scope: "all" });
  };

  const activeFilterCount =
    [filters.dateFrom, filters.dateTo, filters.category, filters.status].filter(Boolean).length +
    (filters.scope !== "all" ? 1 : 0);
  const categoryFilterApplies =
    filters.scope === "contacts" || filters.scope === "appointments" || filters.scope === "documents";
  const statusFilterApplies = filters.scope === "tasks" || filters.scope === "documents";
  const scopeShows = (scope: Exclude<FilterScope, "all">): boolean =>
    filters.scope === "all" || filters.scope === scope;
  const showsUnscopedTypes = filters.scope === "all";

  // Navigation items removed - redundant with sidebar

  const hasResults = (contacts?.length || 0) + (appointments?.length || 0) + 
                     (tasks?.length || 0) + (documents?.length || 0) + 
                     (letters?.length || 0) + (protocols?.length || 0) +
                     (caseFiles?.length || 0) + (archivedTasks?.length || 0) +
                     activeDecisions.length + archivedDecisions.length +
                     activePlannings.length + archivedPlannings.length > 0;

  // Beim Nachladen bleiben die bisherigen Treffer stehen; nur der Hinweis zeigt Aktivität.
  const isSearching = searchQuery !== debouncedQuery || fetchingSearchQueries > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center border-b px-3">
        <CommandInput 
          placeholder="Durchsuche Kontakte, Termine, Aufgaben, Dokumente... (mind. 2 Zeichen)" 
          onValueChange={setSearchQuery}
          value={searchQuery}
          className="border-0 focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="ml-2 flex items-center gap-1"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="border-b p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Filter</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Filter zurücksetzen
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="global-search-scope">Bereich</label>
              <select
                id="global-search-scope"
                value={filters.scope}
                onChange={(e) => setFilters({ ...filters, scope: e.target.value as FilterScope })}
                className="w-full rounded border bg-background px-2 py-1 text-sm"
              >
                {FILTER_SCOPES.map((scope) => (
                  <option key={scope.value} value={scope.value}>{scope.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Von Datum</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Bis Datum</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Kategorie</label>
              <input
                type="text"
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
                disabled={!categoryFilterApplies}
                placeholder={categoryFilterApplies ? "z.B. Meeting" : "Bereich wählen"}
                className="w-full px-2 py-1 text-sm border rounded disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <input
                type="text"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                disabled={!statusFilterApplies}
                placeholder={statusFilterApplies ? "z.B. offen" : "Bereich wählen"}
                className="w-full px-2 py-1 text-sm border rounded disabled:opacity-50"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kategorie und Status gelten nur im gewählten Bereich, weil die Werte sich je Bereich unterscheiden.
          </p>
        </div>
      )}

      <CommandList>
        {canAskKnowledge && user && currentTenant && (
          <CommandGroup heading="Aktionen" forceMount>
            <CommandItem
              forceMount
              value="knowledge-question-create"
              onSelect={() => runCommand(() => {
                // Wait for the search dialog's closing focus restoration.
                window.setTimeout(() => openKnowledgeQuestion(searchQuery.trim()), 250);
              })}
            >
              <MessageCircleQuestion className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {searchQuery.trim() ? `„${searchQuery.trim()}“ als Wissensfrage stellen` : "Wissensfrage stellen"}
              </span>
            </CommandItem>
          </CommandGroup>
        )}
        {searchErrors.length > 0 && (
          <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-3 text-sm" role="alert">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-destructive">
                  Die Suche konnte nicht vollständig ausgeführt werden.
                </p>
                <p className="mt-1 text-muted-foreground">
                  {searchErrors.length === 1
                    ? "Eine Quelle lieferte einen Fehler"
                    : `${searchErrors.length} Quellen lieferten einen Fehler`}. Ergebnisse der übrigen Bereiche werden weiterhin angezeigt.
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={retrySearch}>
                  <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
                  Erneut versuchen
                </Button>
              </div>
            </div>
          </div>
        )}
        {isSearching && searchQuery && (
          <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground" role="status" aria-live="polite">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
            <span>Suche läuft …</span>
          </div>
        )}
        <CommandEmpty>
          {searchErrors.length > 0
            ? "Keine Ergebnisse in den verfügbaren Bereichen."
            : "Keine Ergebnisse gefunden."}
        </CommandEmpty>

        {!searchQuery && recentSearches.length > 0 && (
          <>
            <CommandGroup heading={
              <div className="flex items-center justify-between w-full pr-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Zuletzt gesucht</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Löschen
                </Button>
              </div>
            }>
              {recentSearches.map((search, idx) => (
                <CommandItem
                  key={idx}
                  onSelect={() => handleRecentSearchClick(search.query)}
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{search.query}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {!searchQuery && popularSearches && popularSearches.length > 0 && (
          <>
            <CommandGroup heading={
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Beliebte Suchen</span>
              </div>
            }>
              {popularSearches.map((query, idx) => (
                <CommandItem
                  key={idx}
                  onSelect={() => handleRecentSearchClick(query)}
                >
                  <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{query}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}


        {scopeShows("contacts") && contacts && contacts.length > 0 && (
          <CommandGroup heading="👤 Kontakte">
            {contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("contact", contact)))}
              >
                <User className="mr-2 h-4 w-4" />
                <span>{contact.name}</span>
                {contact.organization && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({contact.organization})
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {scopeShows("appointments") && appointments && appointments.length > 0 && (
          <CommandGroup heading="📅 Termine">
            {appointments.map((appointment) => (
              <CommandItem
                key={appointment.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("appointment", appointment)))}
              >
                <Calendar className="mr-2 h-4 w-4" />
                <span>{appointment.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {format(new Date(appointment.start_time), "dd.MM.yyyy HH:mm", { locale: de })}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {scopeShows("tasks") && tasks && tasks.length > 0 && (
          <CommandGroup heading="✅ Aufgaben">
            {tasks.map((task) => (
              <CommandItem
                key={task.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("task", task)))}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>{task.title}</span>
                {task.due_date && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {scopeShows("documents") && documents && documents.length > 0 && (
          <CommandGroup heading="📄 Dokumente">
            {documents.map((doc) => (
              <CommandItem
                key={doc.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("document", doc)))}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{doc.title}</span>
                {doc.category && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({doc.category})
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showsUnscopedTypes && letters && letters.length > 0 && (
          <CommandGroup heading="✉️ Briefe">
            {letters.map((letter) => (
              <CommandItem
                key={letter.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("letter", letter)))}
              >
                <Mail className="mr-2 h-4 w-4" />
                <span>{letter.title}</span>
                {letter.recipient_name && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({letter.recipient_name})
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showsUnscopedTypes && protocols && protocols.length > 0 && (
          <CommandGroup heading="📋 Protokolle">
            {protocols.map((protocol) => (
              <CommandItem
                key={protocol.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("protocol", protocol)))}
              >
                <FileSignature className="mr-2 h-4 w-4" />
                <span>{protocol.title}</span>
                {protocol.meeting_date && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {format(new Date(protocol.meeting_date), "dd.MM.yyyy", { locale: de })}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showsUnscopedTypes && caseFiles && caseFiles.length > 0 && (
          <CommandGroup heading="📁 Fallakten">
            {caseFiles.map((caseFile) => (
              <CommandItem
                key={caseFile.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("caseFile", caseFile)))}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                <span>{caseFile.title}</span>
                {caseFile.reference_number && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({caseFile.reference_number})
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}


        {showsUnscopedTypes && activeDecisions.length > 0 && (
          <CommandGroup heading="🗳️ Entscheidungen">
            {activeDecisions.map((decision) => (
              <CommandItem
                key={decision.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("decision", decision)))}
              >
                <Vote className="mr-2 h-4 w-4" />
                <span>{decision.title}</span>
                {decision.status && (
                  <span className="ml-2 text-xs text-muted-foreground">({decision.status})</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showsUnscopedTypes && archivedDecisions.length > 0 && (
          <CommandGroup heading="🗄️ Archivierte Entscheidungen">
            {archivedDecisions.map((decision) => (
              <CommandItem
                key={decision.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("decision", decision)))}
              >
                <Vote className="mr-2 h-4 w-4" />
                <span>{decision.title}</span>
                <Badge variant="outline" className="ml-2 text-xs">Archiv</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showsUnscopedTypes && activePlannings.length > 0 && (
          <CommandGroup heading="📝 Planungen">
            {activePlannings.map((planning) => (
              <CommandItem
                key={planning.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("planning", planning)))}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>{planning.title}</span>
                {planning.location && (
                  <span className="ml-2 text-xs text-muted-foreground">({planning.location})</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showsUnscopedTypes && archivedPlannings.length > 0 && (
          <CommandGroup heading="🗄️ Archivierte Planungen">
            {archivedPlannings.map((planning) => (
              <CommandItem
                key={planning.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("planning", planning)))}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>{planning.title}</span>
                <Badge variant="outline" className="ml-2 text-xs">Archiv</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {scopeShows("tasks") && archivedTasks && archivedTasks.length > 0 && (
          <CommandGroup heading="🗄️ Archivierte Aufgaben">
            {archivedTasks.map((task) => (
              <CommandItem
                key={task.id}
                onSelect={() => runCommand(() => navigate(buildSearchHref("archivedTask", task)))}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>{task.title}</span>
                <Badge variant="outline" className="ml-2 text-xs">Archiv</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

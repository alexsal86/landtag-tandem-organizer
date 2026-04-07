import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { X, Clock, TrendingUp, Filter } from "lucide-react";
import { 
  User, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Mail, 
  FileSignature,
  Vote,
  CalendarPlus,
  Briefcase
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
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

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    category: "",
    status: ""
  });
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { user } = useAuth();


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
        setSearchQuery(detail.query);
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
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from('search_analytics')
        .select('search_query, result_count')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!data) return [];
      
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

  const {
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
    isLoading: isStillSearching,
    isError,
    resultCount,
    resultTypes,
  } = useGlobalSearch({ query: searchQuery, filters, enabled: open });

  // Track search analytics only when all queries have settled and the debounced query is stable
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2 || isStillSearching) return;
    trackSearchMutation.mutate({ query: debouncedQuery, resultCount, resultTypes });
  }, [debouncedQuery, isStillSearching, resultCount, resultTypes]);

  const runCommand = useCallback((command: () => void) => {
    if (searchQuery && searchQuery.length >= 2) {
      addRecentSearch(searchQuery);
    }
    setOpen(false);
    setSearchQuery("");
    setFilters({ dateFrom: "", dateTo: "", category: "", status: "" });
    command();
  }, [searchQuery]);

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", category: "", status: "" });
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  // Navigation items removed - redundant with sidebar

  const isSearching = searchQuery !== debouncedQuery || isStillSearching;

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
                placeholder="z.B. Meeting"
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <input
                type="text"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                placeholder="z.B. pending"
                className="w-full px-2 py-1 text-sm border rounded"
              />
            </div>
          </div>
        </div>
      )}

      <CommandList>
        {isSearching && searchQuery ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Suche läuft...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">Suche konnte nicht geladen werden.</div>
        ) : (
          <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        )}

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


        {contacts && contacts.length > 0 && (
          <CommandGroup heading="👤 Kontakte">
            {contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                onSelect={() => runCommand(() => navigate(`/?section=contacts&contact=${contact.id}&highlight=${contact.id}`))}
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

        {appointments && appointments.length > 0 && (
          <CommandGroup heading="📅 Termine">
            {appointments.map((appointment) => (
              <CommandItem
                key={appointment.id}
                onSelect={() => runCommand(() => navigate(`/?section=calendar&appointment=${appointment.id}&highlight=${appointment.id}`))}
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

        {tasks && tasks.length > 0 && (
          <CommandGroup heading="✅ Aufgaben">
            {tasks.map((task) => (
              <CommandItem
                key={task.id}
                onSelect={() => runCommand(() => navigate(`/?section=tasks&task=${task.id}&highlight=${task.id}`))}
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

        {documents && documents.length > 0 && (
          <CommandGroup heading="📄 Dokumente">
            {documents.map((doc) => (
              <CommandItem
                key={doc.id}
                onSelect={() => runCommand(() => navigate(`/?section=documents&document=${doc.id}&highlight=${doc.id}`))}
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

        {letters && letters.length > 0 && (
          <CommandGroup heading="✉️ Briefe">
            {letters.map((letter) => (
              <CommandItem
                key={letter.id}
                onSelect={() => runCommand(() => navigate(`/letters/${letter.id}?highlight=${letter.id}`))}
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

        {protocols && protocols.length > 0 && (
          <CommandGroup heading="📋 Protokolle">
            {protocols.map((protocol) => (
              <CommandItem
                key={protocol.id}
                onSelect={() => runCommand(() => navigate(`/?section=meetings&meeting=${protocol.id}&highlight=${protocol.id}`))}
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

        {caseFiles && caseFiles.length > 0 && (
          <CommandGroup heading="📁 Fallakten">
            {caseFiles.map((caseFile) => (
              <CommandItem
                key={caseFile.id}
                onSelect={() => runCommand(() => navigate(`/?section=casefiles&casefile=${caseFile.id}&highlight=${caseFile.id}`))}
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


        {activeDecisions.length > 0 && (
          <CommandGroup heading="🗳️ Entscheidungen">
            {activeDecisions.map((decision) => (
              <CommandItem
                key={decision.id}
                onSelect={() => runCommand(() => navigate(`/decisions?id=${decision.id}&highlight=${decision.id}`))}
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

        {archivedDecisions.length > 0 && (
          <CommandGroup heading="🗄️ Archivierte Entscheidungen">
            {archivedDecisions.map((decision) => (
              <CommandItem
                key={decision.id}
                onSelect={() => runCommand(() => navigate(`/decisions?id=${decision.id}&highlight=${decision.id}`))}
              >
                <Vote className="mr-2 h-4 w-4" />
                <span>{decision.title}</span>
                <Badge variant="outline" className="ml-2 text-xs">Archiv</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {activePlannings.length > 0 && (
          <CommandGroup heading="📝 Planungen">
            {activePlannings.map((planning) => (
              <CommandItem
                key={planning.id}
                onSelect={() => runCommand(() => navigate(`/eventplanning/${planning.id}?highlight=${planning.id}`))}
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

        {archivedPlannings.length > 0 && (
          <CommandGroup heading="🗄️ Archivierte Planungen">
            {archivedPlannings.map((planning) => (
              <CommandItem
                key={planning.id}
                onSelect={() => runCommand(() => navigate(`/eventplanning/${planning.id}?highlight=${planning.id}`))}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                <span>{planning.title}</span>
                <Badge variant="outline" className="ml-2 text-xs">Archiv</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {archivedTasks && archivedTasks.length > 0 && (
          <CommandGroup heading="🗄️ Archivierte Aufgaben">
            {archivedTasks.map((task) => (
              <CommandItem
                key={task.id}
                onSelect={() => runCommand(() => navigate(`/?section=tasks&archived=true&task=${task.id}&highlight=${task.id}`))}
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

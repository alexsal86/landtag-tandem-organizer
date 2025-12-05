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
  Home,
  Users,
  Vote,
  MessageSquare,
  CalendarPlus,
  MapPin,
  Settings,
  Briefcase
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { debounce } from "@/utils/debounce";
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

  // Custom event listener for programmatic opening
  useEffect(() => {
    const handleOpenSearch = () => setOpen(true);
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
      await supabase.from('search_analytics').insert({
        user_id: user.id,
        tenant_id: currentTenant.id,
        search_query: query,
        result_count: resultCount,
        result_types: resultTypes
      });
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
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([query]) => query);
    },
    enabled: !!currentTenant?.id && open
  });

  // Debounced search
  const debouncedSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  // Search queries with fuzzy search
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ['global-search-contacts', searchQuery, currentTenant?.id, filters],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      let query = supabase
        .from('contacts')
        .select('id, name, organization, avatar_url, category')
        .eq('tenant_id', currentTenant!.id);
      
      // Fuzzy search using pg_trgm similarity
      query = query.or(`name.ilike.%${searchQuery}%,organization.ilike.%${searchQuery}%`);
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      const { data } = await query.limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['global-search-appointments', searchQuery, currentTenant?.id, filters],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      let query = supabase
        .from('appointments')
        .select('id, title, start_time, location, category')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
      
      if (filters.dateFrom) {
        query = query.gte('start_time', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('start_time', filters.dateTo);
      }
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      const { data } = await query
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['global-search-tasks', searchQuery, currentTenant?.id, filters],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      let query = supabase
        .from('tasks')
        .select('id, title, due_date, status, priority')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      
      if (filters.status && filters.status !== 'completed') {
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
      
      const { data } = await query
        .order('due_date', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['global-search-documents', searchQuery, currentTenant?.id, filters],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      let query = supabase
        .from('documents')
        .select('id, title, description, category, status')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data } = await query
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: letters, isLoading: lettersLoading } = useQuery({
    queryKey: ['global-search-letters', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('letters')
        .select('id, title, recipient_name, letter_date')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,recipient_name.ilike.%${searchQuery}%`)
        .order('letter_date', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: protocols, isLoading: protocolsLoading } = useQuery({
    queryKey: ['global-search-protocols', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('meetings')
        .select('id, title, meeting_date')
        .eq('tenant_id', currentTenant!.id)
        .ilike('title', `%${searchQuery}%`)
        .order('meeting_date', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: caseFiles, isLoading: caseFilesLoading } = useQuery({
    queryKey: ['global-search-casefiles', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('case_files')
        .select('id, title, reference_number, status, case_type')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,reference_number.ilike.%${searchQuery}%`)
        .order('updated_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  // Track search when results change
  useEffect(() => {
    if (searchQuery && searchQuery.length >= 2) {
      const resultCount = (contacts?.length || 0) + (appointments?.length || 0) + 
                          (tasks?.length || 0) + (documents?.length || 0) + 
                          (letters?.length || 0) + (protocols?.length || 0) +
                          (caseFiles?.length || 0);
      const resultTypes: string[] = [];
      if (contacts?.length) resultTypes.push('contacts');
      if (appointments?.length) resultTypes.push('appointments');
      if (tasks?.length) resultTypes.push('tasks');
      if (documents?.length) resultTypes.push('documents');
      if (letters?.length) resultTypes.push('letters');
      if (protocols?.length) resultTypes.push('protocols');
      if (caseFiles?.length) resultTypes.push('casefiles');
      
      trackSearchMutation.mutate({ query: searchQuery, resultCount, resultTypes });
    }
  }, [contacts, appointments, tasks, documents, letters, protocols, caseFiles, searchQuery]);

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
    debouncedSearch(query);
  };

  const clearFilters = () => {
    setFilters({ dateFrom: "", dateTo: "", category: "", status: "" });
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  const navigationItems = [
    { label: "Dashboard", icon: Home, path: "/" },
    { label: "Terminkalender", icon: Calendar, path: "/?section=calendar" },
    { label: "Kontakte", icon: Users, path: "/?section=contacts" },
    { label: "Aufgaben", icon: CheckSquare, path: "/?section=tasks" },
    { label: "FallAkten", icon: Briefcase, path: "/?section=casefiles" },
    { label: "Entscheidungen", icon: Vote, path: "/?section=decisions" },
    { label: "Jour fixe", icon: MessageSquare, path: "/?section=meetings" },
    { label: "Planungen", icon: CalendarPlus, path: "/?section=eventplanning" },
    { label: "Wahlkreise", icon: MapPin, path: "/?section=wahlkreise" },
    { label: "Stadtteile KA", icon: MapPin, path: "/stadtteile-karlsruhe" },
    { label: "Dokumente", icon: FileText, path: "/?section=documents" },
    { label: "Korrespondenz", icon: Mail, path: "/?section=letters" },
    { label: "Verwaltung", icon: Settings, path: "/?section=administration" },
  ];

  const hasResults = (contacts?.length || 0) + (appointments?.length || 0) + 
                     (tasks?.length || 0) + (documents?.length || 0) + 
                     (letters?.length || 0) + (protocols?.length || 0) +
                     (caseFiles?.length || 0) > 0;

  const isSearching = contactsLoading || appointmentsLoading || tasksLoading || 
                      documentsLoading || lettersLoading || protocolsLoading || caseFilesLoading;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center border-b px-3">
        <CommandInput 
          placeholder="Durchsuche Kontakte, Termine, Aufgaben, Dokumente... (mind. 2 Zeichen)" 
          onValueChange={debouncedSearch}
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

        {!searchQuery && (
          <CommandGroup heading="🚀 Navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.path}
                  onSelect={() => runCommand(() => navigate(item.path))}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {contacts && contacts.length > 0 && (
          <CommandGroup heading="👤 Kontakte">
            {contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                onSelect={() => runCommand(() => navigate(`/?section=contacts&contact=${contact.id}`))}
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
                onSelect={() => runCommand(() => navigate(`/?section=calendar&appointment=${appointment.id}`))}
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
                onSelect={() => runCommand(() => navigate(`/?section=tasks&task=${task.id}`))}
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
                onSelect={() => runCommand(() => navigate(`/?section=documents&document=${doc.id}`))}
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
                onSelect={() => runCommand(() => navigate(`/?section=letters&letter=${letter.id}`))}
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
                onSelect={() => runCommand(() => navigate(`/?section=meetings&meeting=${protocol.id}`))}
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
          <CommandGroup heading="📁 FallAkten">
            {caseFiles.map((caseFile) => (
              <CommandItem
                key={caseFile.id}
                onSelect={() => runCommand(() => navigate(`/?section=casefiles&casefile=${caseFile.id}`))}
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
      </CommandList>
    </CommandDialog>
  );
}

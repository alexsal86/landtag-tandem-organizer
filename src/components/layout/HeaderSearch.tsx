import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, FileText, CheckSquare, Calendar, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'contact' | 'document' | 'task' | 'appointment';
  route: string;
}

interface GroupedResults {
  contacts: SearchResult[];
  documents: SearchResult[];
  tasks: SearchResult[];
  appointments: SearchResult[];
}

export function HeaderSearch() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroupedResults>({
    contacts: [],
    documents: [],
    tasks: [],
    appointments: []
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Flatten results for keyboard navigation
  const flatResults = [
    ...results.contacts,
    ...results.documents,
    ...results.tasks,
    ...results.appointments
  ];

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !currentTenant?.id || !user) {
      setResults({ contacts: [], documents: [], tasks: [], appointments: [] });
      return;
    }

    setIsLoading(true);
    const searchTerm = `%${searchQuery}%`;

    try {
      const [contactsRes, documentsRes, tasksRes, appointmentsRes] = await Promise.all([
        // Search contacts
        supabase
          .from('contacts')
          .select('id, name, email, company')
          .eq('tenant_id', currentTenant.id)
          .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},company.ilike.${searchTerm}`)
          .limit(5),
        
        // Search documents
        supabase
          .from('documents')
          .select('id, title, file_name')
          .eq('tenant_id', currentTenant.id)
          .or(`title.ilike.${searchTerm},file_name.ilike.${searchTerm}`)
          .limit(5),
        
        // Search tasks
        supabase
          .from('tasks')
          .select('id, title, description')
          .eq('user_id', user.id)
          .ilike('title', searchTerm)
          .limit(5),
        
        // Search appointments
        supabase
          .from('appointments')
          .select('id, title, location')
          .eq('tenant_id', currentTenant.id)
          .or(`title.ilike.${searchTerm},location.ilike.${searchTerm}`)
          .limit(5)
      ]);

      setResults({
        contacts: (contactsRes.data || []).map(c => ({
          id: c.id,
          title: c.name,
          subtitle: c.email || c.company || undefined,
          type: 'contact' as const,
          route: `/contacts?id=${c.id}`
        })),
        documents: (documentsRes.data || []).map(d => ({
          id: d.id,
          title: d.title,
          subtitle: d.file_name,
          type: 'document' as const,
          route: `/documents?id=${d.id}`
        })),
        tasks: (tasksRes.data || []).map(t => ({
          id: t.id,
          title: t.title,
          subtitle: t.description?.slice(0, 50) || undefined,
          type: 'task' as const,
          route: `/tasks?id=${t.id}`
        })),
        appointments: (appointmentsRes.data || []).map(a => ({
          id: a.id,
          title: a.title,
          subtitle: a.location || undefined,
          type: 'appointment' as const,
          route: `/calendar?id=${a.id}`
        }))
      });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, user]);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < flatResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && flatResults[selectedIndex]) {
          handleResultClick(flatResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route);
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'contact': return User;
      case 'document': return FileText;
      case 'task': return CheckSquare;
      case 'appointment': return Calendar;
    }
  };

  const getCategoryLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'contact': return 'Kontakte';
      case 'document': return 'Dokumente';
      case 'task': return 'Aufgaben';
      case 'appointment': return 'Termine';
    }
  };

  const hasResults = flatResults.length > 0;
  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--nav-muted))]" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Suchen..."
        className="w-64 pl-9 pr-12 py-1.5 text-sm rounded-md bg-[hsl(var(--nav-hover))] border border-[hsl(var(--nav-foreground)/0.2)] text-[hsl(var(--nav-foreground))] placeholder:text-[hsl(var(--nav-muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--nav-accent))]"
      />
      {query ? (
        <button
          onClick={() => {
            setQuery('');
            setResults({ contacts: [], documents: [], tasks: [], appointments: [] });
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="h-4 w-4 text-[hsl(var(--nav-muted))] hover:text-[hsl(var(--nav-foreground))]" />
        </button>
      ) : (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-[hsl(var(--nav-foreground)/0.2)] bg-[hsl(var(--nav-hover))] px-1.5 font-mono text-[10px] font-medium text-[hsl(var(--nav-muted))]">
          ⌘K
        </kbd>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-auto z-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : hasResults ? (
            <div className="py-1">
              {(['contacts', 'documents', 'tasks', 'appointments'] as const).map(category => {
                const categoryResults = results[category];
                if (categoryResults.length === 0) return null;

                return (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {getCategoryLabel(categoryResults[0].type)}
                    </div>
                    {categoryResults.map((result, idx) => {
                      const globalIdx = flatResults.findIndex(r => r.id === result.id);
                      const Icon = getIcon(result.type);
                      
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors",
                            globalIdx === selectedIndex && "bg-accent"
                          )}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Keine Ergebnisse für "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

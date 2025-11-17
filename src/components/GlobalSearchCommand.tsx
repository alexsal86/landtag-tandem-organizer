import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from "@/components/ui/command";
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
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { debounce } from "@/utils/debounce";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

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

  // Debounced search
  const debouncedSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  // Search queries
  const { data: contacts } = useQuery({
    queryKey: ['global-search-contacts', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('contacts')
        .select('id, name, organization, avatar_url')
        .eq('tenant_id', currentTenant!.id)
        .or(`name.ilike.%${searchQuery}%,organization.ilike.%${searchQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: appointments } = useQuery({
    queryKey: ['global-search-appointments', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('appointments')
        .select('id, title, start_time, location')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: tasks } = useQuery({
    queryKey: ['global-search-tasks', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
  });

  const { data: documents } = useQuery({
    queryKey: ['global-search-documents', searchQuery, currentTenant?.id],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from('documents')
        .select('id, title, description, category')
        .eq('tenant_id', currentTenant!.id)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!searchQuery && !!currentTenant?.id && searchQuery.length >= 2,
  });

  const { data: letters } = useQuery({
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

  const { data: protocols } = useQuery({
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

  const runCommand = (command: () => void) => {
    setOpen(false);
    setSearchQuery("");
    command();
  };

  const navigationItems = [
    { label: "Dashboard", icon: Home, path: "/" },
    { label: "Terminkalender", icon: Calendar, path: "/?section=calendar" },
    { label: "Kontakte", icon: Users, path: "/?section=contacts" },
    { label: "Aufgaben", icon: CheckSquare, path: "/?section=tasks" },
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
                     (letters?.length || 0) + (protocols?.length || 0) > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Durchsuche Kontakte, Termine, Aufgaben..." 
        onValueChange={debouncedSearch}
      />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

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
      </CommandList>
    </CommandDialog>
  );
}

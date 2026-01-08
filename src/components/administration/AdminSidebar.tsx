import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Calendar,
  Layers,
  Building,
  FileText,
  Rss,
  Clock,
  Tag,
  ChevronRight,
  User,
  LogIn,
  Activity,
  Users,
  Palette,
  MessageSquare,
  History,
  CalendarCheck,
  UserCheck,
  FileCheck,
  CalendarClock,
  RefreshCcw,
  CheckSquare,
  ListTodo,
  Gavel,
  File,
  Briefcase,
  Landmark,
  MapPin,
  Mail,
  Puzzle,
  Layout,
  CircleCheck,
  Newspaper,
  Archive
} from "lucide-react";

export interface AdminMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: AdminSubItem[];
}

export interface AdminSubItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
}

interface AdminSidebarProps {
  activeSection: string;
  activeSubSection: string;
  onNavigate: (section: string, subSection?: string) => void;
  isSuperAdmin: boolean;
  annualTasksBadge?: number;
}

export const adminMenuItems: AdminMenuItem[] = [
  {
    id: "system",
    label: "System",
    icon: Settings,
    children: [
      { id: "general", label: "Allgemein", icon: Settings },
      { id: "login", label: "Login-Anpassung", icon: LogIn },
      { id: "status", label: "Status", icon: Activity },
      { id: "collaboration", label: "Kollaboration", icon: Users },
      { id: "expense", label: "Verwaltung", icon: Briefcase },
      { id: "roles", label: "Rechte", icon: UserCheck, superAdminOnly: true },
      { id: "usercolors", label: "Benutzerfarben", icon: Palette, superAdminOnly: true },
      { id: "matrix", label: "Matrix", icon: MessageSquare },
      { id: "auditlogs", label: "Audit-Logs", icon: History },
    ],
  },
  {
    id: "topics",
    label: "Themen",
    icon: Tag,
  },
  {
    id: "appointments",
    label: "Termine",
    icon: Calendar,
    children: [
      { id: "config", label: "Kategorien & Status", icon: CalendarCheck },
      { id: "guests", label: "Standard-Gäste", icon: UserCheck },
      { id: "preparation", label: "Vorbereitung", icon: FileCheck },
      { id: "calendar-debug", label: "Kalender Debug", icon: CalendarClock },
      { id: "calendar-sync", label: "Synchronisation", icon: RefreshCcw },
    ],
  },
  {
    id: "datatypes",
    label: "Datentypen",
    icon: Layers,
    children: [
      { id: "task-config", label: "Aufgaben", icon: CheckSquare },
      { id: "todo-config", label: "ToDos", icon: ListTodo },
      { id: "decisions", label: "Entscheidungen", icon: Gavel },
      { id: "documenttypes", label: "Dokumenttypen", icon: File },
      { id: "casefiletypes", label: "FallAkten-Typen", icon: Briefcase },
    ],
  },
  {
    id: "politics",
    label: "Politik & Wahlkreise",
    icon: Building,
    children: [
      { id: "associations", label: "Kreisverbände", icon: Landmark },
      { id: "districts", label: "Betreuungswahlkreise", icon: MapPin },
    ],
  },
  {
    id: "documents",
    label: "Dokumente & Vorlagen",
    icon: FileText,
    children: [
      { id: "letters", label: "Briefvorlagen", icon: Mail },
      { id: "meetings", label: "Meetings", icon: Users },
      { id: "plannings", label: "Planungen", icon: Layout },
    ],
  },
  {
    id: "rss",
    label: "RSS & News",
    icon: Rss,
    children: [
      { id: "sources", label: "RSS-Quellen", icon: Rss },
      { id: "settings", label: "RSS-Einstellungen", icon: Settings },
      { id: "templates", label: "E-Mail-Vorlagen", icon: Newspaper },
    ],
  },
  {
    id: "annual",
    label: "Jährliche Aufgaben",
    icon: CircleCheck,
  },
  {
    id: "archiving",
    label: "Archivierung",
    icon: Archive,
  },
];

export function AdminSidebar({
  activeSection,
  activeSubSection,
  onNavigate,
  isSuperAdmin,
  annualTasksBadge,
}: AdminSidebarProps) {
  const [openSections, setOpenSections] = useState<string[]>([activeSection]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleClick = (item: AdminMenuItem, subItem?: AdminSubItem) => {
    if (subItem) {
      onNavigate(item.id, subItem.id);
    } else if (!item.children) {
      onNavigate(item.id);
    } else {
      // Toggle section and navigate to first child
      toggleSection(item.id);
      if (!openSections.includes(item.id) && item.children.length > 0) {
        const firstVisible = item.children.find(
          (c) => !c.superAdminOnly || isSuperAdmin
        );
        if (firstVisible) {
          onNavigate(item.id, firstVisible.id);
        }
      }
    }
  };

  return (
    <div className="w-64 border-r bg-muted/30 h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Administration</h2>
        <p className="text-xs text-muted-foreground">Systemkonfiguration</p>
      </div>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-2 space-y-1">
          {adminMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isOpen = openSections.includes(item.id);
            const hasChildren = item.children && item.children.length > 0;
            const visibleChildren = item.children?.filter(
              (c) => !c.superAdminOnly || isSuperAdmin
            );

            // Handle badge for annual tasks
            const showBadge = item.id === "annual" && annualTasksBadge && annualTasksBadge > 0;

            if (!hasChildren) {
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 h-10",
                    isActive && "bg-secondary font-medium"
                  )}
                  onClick={() => handleClick(item)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {showBadge && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {annualTasksBadge}
                    </Badge>
                  )}
                </Button>
              );
            }

            return (
              <Collapsible
                key={item.id}
                open={isOpen}
                onOpenChange={() => toggleSection(item.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2 h-10",
                      isActive && "bg-secondary/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-90"
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                  {visibleChildren?.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive =
                      activeSection === item.id && activeSubSection === subItem.id;

                    return (
                      <Button
                        key={subItem.id}
                        variant={isSubActive ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start gap-2 h-9 text-sm",
                          isSubActive && "bg-secondary font-medium"
                        )}
                        onClick={() => handleClick(item, subItem)}
                      >
                        {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
                        <span>{subItem.label}</span>
                      </Button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

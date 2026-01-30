import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Users2,
  CalendarDays,
  Database,
  FileStack,
  Building2,
  Workflow,
  ChevronRight,
  Settings,
  LogIn,
  UserCheck,
  History,
  Archive,
  Activity,
  Palette,
  Users,
  MessageSquare,
  CalendarCheck,
  FileCheck,
  CalendarClock,
  RefreshCcw,
  Tag,
  CheckSquare,
  ListTodo,
  Gavel,
  File,
  Briefcase,
  Mail,
  Layout,
  Newspaper,
  Landmark,
  MapPin,
  CreditCard,
  Rss,
  CircleCheck
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
    id: "security",
    label: "System & Sicherheit",
    icon: Shield,
    children: [
      { id: "general", label: "Allgemein", icon: Settings },
      { id: "login", label: "Login-Anpassung", icon: LogIn },
      { id: "tenants", label: "Tenants", icon: Building2, superAdminOnly: true },
      { id: "roles", label: "Rechte & Rollen", icon: UserCheck, superAdminOnly: true },
      { id: "auditlogs", label: "Audit-Logs", icon: History },
      { id: "archiving", label: "Archivierung", icon: Archive },
    ],
  },
  {
    id: "users",
    label: "Benutzer & Kommunikation",
    icon: Users2,
    children: [
      { id: "status", label: "Status", icon: Activity },
      { id: "usercolors", label: "Benutzerfarben", icon: Palette, superAdminOnly: true },
      { id: "collaboration", label: "Kollaboration", icon: Users },
      { id: "matrix", label: "Matrix-Chat", icon: MessageSquare },
    ],
  },
  {
    id: "calendar",
    label: "Kalender & Termine",
    icon: CalendarDays,
    children: [
      { id: "config", label: "Kategorien & Status & Orte", icon: CalendarCheck },
      { id: "guests", label: "Standard-Gäste", icon: UserCheck },
      { id: "preparation", label: "Vorbereitung", icon: FileCheck },
      { id: "sync", label: "Synchronisation", icon: RefreshCcw },
      { id: "debug", label: "Debug", icon: CalendarClock },
    ],
  },
  {
    id: "content",
    label: "Inhalte & Daten",
    icon: Database,
    children: [
      { id: "topics", label: "Themen", icon: Tag },
      { id: "tasks", label: "Aufgaben", icon: CheckSquare },
      { id: "todos", label: "ToDos", icon: ListTodo },
      { id: "decisions", label: "Entscheidungen", icon: Gavel },
      { id: "documents", label: "Dokumenttypen", icon: File },
      { id: "casefiles", label: "FallAkten-Typen", icon: Briefcase },
    ],
  },
  {
    id: "templates",
    label: "Vorlagen",
    icon: FileStack,
    children: [
      { id: "letters", label: "Briefvorlagen", icon: Mail },
      { id: "meetings", label: "Meeting-Templates", icon: Users },
      { id: "plannings", label: "Planungs-Templates", icon: Layout },
      { id: "emails", label: "E-Mail-Vorlagen", icon: Newspaper },
    ],
  },
  {
    id: "politics",
    label: "Politik & Organisation",
    icon: Building2,
    children: [
      { id: "associations", label: "Kreisverbände", icon: Landmark },
      { id: "districts", label: "Betreuungswahlkreise", icon: MapPin },
      { id: "mapping", label: "Wahlkreis-Zuordnung", icon: Building2 },
      { id: "expense", label: "Verwaltung", icon: CreditCard },
    ],
  },
  {
    id: "automation",
    label: "Automatisierung",
    icon: Workflow,
    children: [
      { id: "rss-sources", label: "RSS-Quellen", icon: Rss },
      { id: "rss-settings", label: "RSS-Einstellungen", icon: Settings },
      { id: "annual", label: "Jährliche Aufgaben", icon: CircleCheck },
    ],
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
            const showAnnualBadge = item.id === "automation" && annualTasksBadge && annualTasksBadge > 0;

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
                    {showAnnualBadge && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs mr-1">
                        {annualTasksBadge}
                      </Badge>
                    )}
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

                    // Show badge on annual tasks sub-item
                    const showSubBadge = item.id === "automation" && subItem.id === "annual" && annualTasksBadge && annualTasksBadge > 0;

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
                        <span className="flex-1">{subItem.label}</span>
                        {showSubBadge && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                            {annualTasksBadge}
                          </Badge>
                        )}
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

import { Calendar, Users, CheckSquare, Home, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "calendar", label: "Terminkalender", icon: Calendar },
    { id: "contacts", label: "Kontakte", icon: Users },
    { id: "tasks", label: "Aufgaben", icon: CheckSquare },
    { id: "documents", label: "Dokumente", icon: FileText },
    { id: "settings", label: "Einstellungen", icon: Settings },
  ];

  return (
    <nav className="bg-card border-r border-border h-screen w-64 flex flex-col shadow-card">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <button 
          onClick={() => onSectionChange("dashboard")}
          className="flex items-center gap-3 w-full text-left hover:bg-accent hover:text-accent-foreground rounded-lg p-2 transition-colors"
        >
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">LandtagsOS</h1>
            <p className="text-sm text-muted-foreground">Koordinationssystem</p>
          </div>
        </button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">MK</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-accent-foreground truncate">Max Kellner</p>
            <p className="text-sm text-muted-foreground truncate">MdL - Wahlkreis 42</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, CheckSquare, Clock, FileText, Phone, AlertCircle, Circle, GripVertical } from "lucide-react";
import { DashboardWidget as WidgetType } from '@/hooks/useDashboardLayout';

interface WidgetProps {
  widget: WidgetType;
  isDragging?: boolean;
  isEditMode: boolean;
}

interface QuickStats {
  todayMeetings: number;
  pendingTasks: number;
  newContacts: number;
  upcomingDeadlines: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  time: string;
  type: "meeting" | "appointment" | "deadline";
  location?: string;
}

interface PendingTask {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  daysUntilDue: number;
  category: "deadline" | "meeting" | "follow-up" | "review";
}

// Sample data - in a real app this would come from props or context
const sampleStats: QuickStats = {
  todayMeetings: 4,
  pendingTasks: 12,
  newContacts: 3,
  upcomingDeadlines: 2,
};

const sampleEvents: UpcomingEvent[] = [
  {
    id: "1",
    title: "Ausschusssitzung Bildung",
    time: "10:00",
    type: "meeting",
    location: "Raum 204",
  },
  {
    id: "2",
    title: "Bürgersprechstunde",
    time: "14:30",
    type: "appointment",
    location: "Wahlkreisbüro",
  },
  {
    id: "3",
    title: "Stellungnahme Verkehrspolitik",
    time: "18:00",
    type: "deadline",
  },
];

const sampleTasks: PendingTask[] = [
  {
    id: "1",
    title: "Stellungnahme Verkehrspolitik",
    description: "Überarbeitung der Verkehrskonzepte für den Wahlkreis",
    priority: "high" as const,
    dueDate: "Heute",
    daysUntilDue: 0,
    category: "deadline" as const,
  },
  {
    id: "2", 
    title: "Nachfassgespräch Bürgerinitiative",
    description: "Follow-up mit Dr. Maria Schmidt bezüglich Verkehrsberuhigung",
    priority: "high" as const,
    daysUntilDue: 1,
    dueDate: "Morgen",
    category: "follow-up" as const,
  },
  {
    id: "3",
    title: "Vorbereitung Ausschusssitzung",
    description: "Unterlagen für Bildungsausschuss durchgehen",
    priority: "medium" as const,
    dueDate: "Fr, 24.01",
    daysUntilDue: 3,
    category: "meeting" as const,
  },
].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

const quickActions = [
  { label: "Neuer Termin", icon: Calendar, variant: "default" as const },
  { label: "Kontakt hinzufügen", icon: Users, variant: "secondary" as const },
  { label: "Aufgabe erstellen", icon: CheckSquare, variant: "secondary" as const },
];

const getPriorityColor = (priority: PendingTask["priority"]) => {
  switch (priority) {
    case "high": return "bg-destructive text-destructive-foreground";
    case "medium": return "bg-government-gold text-foreground";
    case "low": return "bg-muted text-muted-foreground";
  }
};

const getCategoryIcon = (category: PendingTask["category"]) => {
  switch (category) {
    case "deadline": return AlertCircle;
    case "meeting": return Users;
    case "follow-up": return Phone;
    case "review": return FileText;
  }
};

export function DashboardWidget({ widget, isDragging, isEditMode }: WidgetProps) {
  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'stats':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Termine heute</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{sampleStats.todayMeetings}</div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Offene Aufgaben</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{sampleStats.pendingTasks}</div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Neue Kontakte</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{sampleStats.newContacts}</div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deadlines</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{sampleStats.upcomingDeadlines}</div>
              </CardContent>
            </Card>
          </div>
        );

      case 'tasks':
        return (
          <div className="space-y-3">
            {sampleTasks.slice(0, 5).map((task) => {
              const CategoryIcon = getCategoryIcon(task.category);
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <CategoryIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-accent-foreground truncate">{task.title}</span>
                        <Badge 
                          className={`${getPriorityColor(task.priority)} text-xs`}
                          variant="secondary"
                        >
                          {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{task.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-medium ${
                      task.daysUntilDue === 0 ? "text-destructive" :
                      task.daysUntilDue <= 2 ? "text-government-gold" :
                      "text-muted-foreground"
                    }`}>
                      {task.dueDate}
                    </span>
                    {task.daysUntilDue === 0 && (
                      <Circle className="h-2 w-2 fill-destructive text-destructive" />
                    )}
                  </div>
                </div>
              );
            })}
            {sampleTasks.length > 5 && (
              <div className="mt-4 pt-3 border-t border-border">
                <Button variant="outline" className="w-full text-sm">
                  Alle {sampleTasks.length} Aufgaben anzeigen
                </Button>
              </div>
            )}
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-4">
            {sampleEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-accent-foreground">{event.title}</span>
                    {event.location && (
                      <span className="text-sm text-muted-foreground">{event.location}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-accent-foreground">{event.time}</span>
                  {event.type === "meeting" && <Users className="h-4 w-4 text-primary" />}
                  {event.type === "appointment" && <Phone className="h-4 w-4 text-primary" />}
                  {event.type === "deadline" && <FileText className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            ))}
          </div>
        );

      case 'actions':
        return (
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant}
                className="w-full justify-start gap-2 h-12"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        );

      default:
        return <div>Unbekanntes Widget</div>;
    }
  };

  return (
    <Card 
      className={`bg-card shadow-card border-border ${
        isDragging ? 'rotate-3 shadow-lg' : 'hover:shadow-elegant'
      } transition-all duration-300 ${isEditMode ? 'cursor-move' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isEditMode && <GripVertical className="h-4 w-4 text-muted-foreground" />}
            {widget.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {renderWidgetContent()}
      </CardContent>
    </Card>
  );
}
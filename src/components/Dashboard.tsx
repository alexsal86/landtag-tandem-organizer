import { Calendar, Users, CheckSquare, Clock, FileText, Phone, AlertCircle, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpenseWidget } from "@/components/widgets/ExpenseWidget";

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

export function Dashboard() {
  const stats: QuickStats = {
    todayMeetings: 4,
    pendingTasks: 12,
    newContacts: 3,
    upcomingDeadlines: 2,
  };

  const upcomingEvents: UpcomingEvent[] = [
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

  const quickActions = [
    { label: "Neuer Termin", icon: Calendar, variant: "default" as const },
    { label: "Kontakt hinzufügen", icon: Users, variant: "secondary" as const },
    { label: "Aufgabe erstellen", icon: CheckSquare, variant: "secondary" as const },
  ];

  const pendingTasks: PendingTask[] = [
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
    {
      id: "4",
      title: "Monatsreport Wahlkreisarbeit",
      description: "Zusammenfassung der Aktivitäten für Fraktionsleitung",
      priority: "medium" as const,
      dueDate: "Mo, 27.01", 
      daysUntilDue: 6,
      category: "review" as const,
    },
    {
      id: "5",
      title: "Rückruf Wirtschaftsverband", 
      description: "Gespräch mit Sarah Müller terminieren",
      priority: "low" as const,
      dueDate: "Mi, 29.01",
      daysUntilDue: 8,
      category: "follow-up" as const,
    },
  ].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

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

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Willkommen zurück! Hier ist Ihre heutige Übersicht.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Termine heute</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.todayMeetings}</div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Aufgaben</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.pendingTasks}</div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neue Kontakte</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.newContacts}</div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deadlines</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.upcomingDeadlines}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        {/* Pending Tasks Overview */}
        <Card className="xl:col-span-2 bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Ausstehende Aufgaben
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTasks.slice(0, 5).map((task) => {
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
            </div>
            {pendingTasks.length > 5 && (
              <div className="mt-4 pt-3 border-t border-border">
                <Button variant="outline" className="w-full text-sm">
                  Alle {pendingTasks.length} Aufgaben anzeigen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card className="xl:col-span-2 bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Heutiger Terminplan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
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
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Expense Widget */}
        <ExpenseWidget className="bg-card shadow-card border-border" />
      </div>
    </div>
  );
}
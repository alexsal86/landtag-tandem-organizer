import { Calendar, Users, CheckSquare, Clock, FileText, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2 bg-card shadow-card border-border">
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
      </div>
    </div>
  );
}
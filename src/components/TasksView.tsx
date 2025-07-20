import { useState } from "react";
import { Plus, CheckSquare, Square, Clock, Flag, Calendar, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in-progress" | "completed";
  dueDate: string;
  category: "legislation" | "constituency" | "committee" | "personal";
  assignedTo?: string;
  progress?: number;
}

export function TasksView() {
  const [filter, setFilter] = useState<string>("all");

  const tasks: Task[] = [
    {
      id: "1",
      title: "Stellungnahme Verkehrsgesetz",
      description: "Überarbeitung der Stellungnahme zum neuen Verkehrsgesetz bis Freitag",
      priority: "high",
      status: "in-progress",
      dueDate: "2024-01-15",
      category: "legislation",
      assignedTo: "Max Kellner",
      progress: 65,
    },
    {
      id: "2",
      title: "Vorbereitung Ausschusssitzung",
      description: "Unterlagen für die Bildungsausschuss-Sitzung vorbereiten",
      priority: "medium",
      status: "todo",
      dueDate: "2024-01-12",
      category: "committee",
      assignedTo: "Max Kellner",
    },
    {
      id: "3",
      title: "Bürgersprechstunde auswerten",
      description: "Anliegen aus der gestrigen Bürgersprechstunde dokumentieren",
      priority: "low",
      status: "completed",
      dueDate: "2024-01-10",
      category: "constituency",
      assignedTo: "Max Kellner",
    },
    {
      id: "4",
      title: "Pressemitteilung Umweltpolitik",
      description: "Entwurf für Pressemitteilung zur neuen Umweltinitiative",
      priority: "medium",
      status: "todo",
      dueDate: "2024-01-18",
      category: "personal",
      assignedTo: "Max Kellner",
    },
  ];

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-government-gold text-white";
      case "low":
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "todo":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getCategoryColor = (category: Task["category"]) => {
    switch (category) {
      case "legislation":
        return "bg-primary text-primary-foreground";
      case "committee":
        return "bg-government-blue text-white";
      case "constituency":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "personal":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && tasks.find(t => t.dueDate === dueDate)?.status !== "completed";
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === "all") return true;
    if (filter === "pending") return task.status !== "completed";
    if (filter === "overdue") return isOverdue(task.dueDate);
    return task.status === filter;
  });

  const toggleTaskStatus = (taskId: string) => {
    // In a real app, this would update the task in state/database
    console.log("Toggle task:", taskId);
  };

  const taskCounts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    overdue: tasks.filter(t => isOverdue(t.dueDate)).length,
  };

  const filters = [
    { value: "all", label: "Alle Aufgaben", count: taskCounts.all },
    { value: "pending", label: "Offen", count: taskCounts.todo + taskCounts.inProgress },
    { value: "todo", label: "Zu erledigen", count: taskCounts.todo },
    { value: "in-progress", label: "In Bearbeitung", count: taskCounts.inProgress },
    { value: "completed", label: "Erledigt", count: taskCounts.completed },
    { value: "overdue", label: "Überfällig", count: taskCounts.overdue },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Aufgaben</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre Aufgaben und To-Dos effizient
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Neue Aufgabe
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          {filters.map((filterOption) => (
            <Button
              key={filterOption.value}
              variant={filter === filterOption.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption.value)}
              className="whitespace-nowrap"
            >
              {filterOption.label} ({filterOption.count})
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Task List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleTaskStatus(task.id)}
                    />
                  </div>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-semibold text-lg ${
                        task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                      }`}>
                        {task.title}
                      </h3>
                      <div className="flex gap-2 ml-4">
                        <Badge className={getPriorityColor(task.priority)}>
                          <Flag className="h-3 w-3 mr-1" />
                          {task.priority === "high" && "Hoch"}
                          {task.priority === "medium" && "Mittel"}
                          {task.priority === "low" && "Niedrig"}
                        </Badge>
                      </div>
                    </div>

                    <p className={`mb-4 ${
                      task.status === "completed" ? "text-muted-foreground" : "text-muted-foreground"
                    }`}>
                      {task.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span className={isOverdue(task.dueDate) ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {formatDate(task.dueDate)}
                          {isOverdue(task.dueDate) && " (Überfällig)"}
                        </span>
                      </div>

                      <Badge className={getCategoryColor(task.category)}>
                        {task.category === "legislation" && "Gesetzgebung"}
                        {task.category === "committee" && "Ausschuss"}
                        {task.category === "constituency" && "Wahlkreis"}
                        {task.category === "personal" && "Persönlich"}
                      </Badge>

                      <Badge className={getStatusColor(task.status)}>
                        {task.status === "todo" && "Zu erledigen"}
                        {task.status === "in-progress" && "In Bearbeitung"}
                        {task.status === "completed" && "Erledigt"}
                      </Badge>

                      {task.assignedTo && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span className="text-muted-foreground">{task.assignedTo}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {task.progress !== undefined && task.status !== "completed" && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Fortschritt</span>
                          <span className="text-muted-foreground">{task.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <Card className="bg-card shadow-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Aufgaben gefunden</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Es wurden keine Aufgaben gefunden, die Ihren Filterkriterien entsprechen.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Aufgabe hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Übersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gesamt</span>
                  <span className="font-semibold">{taskCounts.all}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Offen</span>
                  <span className="font-semibold">{taskCounts.todo + taskCounts.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Erledigt</span>
                  <span className="font-semibold text-green-600">{taskCounts.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Überfällig</span>
                  <span className="font-semibold text-destructive">{taskCounts.overdue}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Letzte Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium">Aufgabe erledigt</div>
                  <div className="text-muted-foreground">Bürgersprechstunde auswerten</div>
                  <div className="text-xs text-muted-foreground">vor 2 Stunden</div>
                </div>
                <div>
                  <div className="font-medium">Aufgabe aktualisiert</div>
                  <div className="text-muted-foreground">Stellungnahme Verkehrsgesetz</div>
                  <div className="text-xs text-muted-foreground">vor 4 Stunden</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
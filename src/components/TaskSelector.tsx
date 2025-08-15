import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface TaskSelectorProps {
  tasks: any[];
  taskDocuments: Record<string, any[]>;
  onSelectTask: (task: any) => void;
  onClose: () => void;
}

export function TaskSelector({ tasks, taskDocuments, onSelectTask, onClose }: TaskSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Aufgaben durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-3">
        {filteredTasks.map((task) => {
          const documents = taskDocuments[task.id] || [];
          
          return (
            <Card key={task.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    {task.description && (
                      <CardDescription className="text-sm">
                        {task.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onSelectTask(task)}
                    className="ml-4"
                  >
                    Hinzufügen
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                    <span className="capitalize">{task.priority}</span>
                  </div>
                  
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(task.due_date), 'dd.MM.yyyy', { locale: de })}</span>
                    </div>
                  )}
                  
                  {task.assigned_to && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{task.assigned_to}</span>
                    </div>
                  )}
                  
                  {documents.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{documents.length} Dokument(e)</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline">{task.category}</Badge>
                  <Badge variant="secondary">{task.status}</Badge>
                  {task.progress > 0 && (
                    <Badge variant="outline">{task.progress}% abgeschlossen</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine Aufgaben gefunden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
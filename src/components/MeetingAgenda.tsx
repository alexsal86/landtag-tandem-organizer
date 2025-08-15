import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { Plus, Save, ListTodo } from "lucide-react";
import { AgendaItem } from "@/components/AgendaItem";
import { TaskSelector } from "@/components/TaskSelector";
import { Meeting, AgendaItem as AgendaItemType, Profile } from "@/types/meeting";
import { useAgenda } from "@/hooks/useAgenda";
import { useMeetingDocuments } from "@/hooks/useMeetingDocuments";

interface MeetingAgendaProps {
  meeting: Meeting;
  profiles: Profile[];
  tasks: any[];
  taskDocuments: Record<string, any[]>;
  activeMeeting?: Meeting | null;
}

export function MeetingAgenda({ 
  meeting, 
  profiles, 
  tasks, 
  taskDocuments, 
  activeMeeting 
}: MeetingAgendaProps) {
  const [showTaskSelector, setShowTaskSelector] = useState<{itemIndex: number} | null>(null);
  const { loadAgendaDocuments } = useMeetingDocuments();
  
  const {
    agendaItems,
    loadAgendaItems,
    addAgendaItem,
    updateAgendaItem,
    updateAgendaItemResult,
    saveAgendaItems,
    deleteAgendaItem,
    addTaskToAgenda,
    addSubItem,
    onDragEnd
  } = useAgenda();

  // Load agenda items when meeting changes
  useState(() => {
    if (meeting.id) {
      loadAgendaItems(meeting.id);
      // Load documents for all agenda items
      const itemIds = agendaItems.filter(item => item.id).map(item => item.id!);
      if (itemIds.length > 0) {
        loadAgendaDocuments(itemIds);
      }
    }
  });

  const handleUpdateAgendaItem = (index: number, field: keyof AgendaItemType, value: any) => {
    if (activeMeeting && (field === 'result_text' || field === 'carry_over_to_next')) {
      const item = agendaItems[index];
      if (item.id) {
        updateAgendaItemResult(item.id, field as 'result_text' | 'carry_over_to_next', value);
      }
    } else {
      updateAgendaItem(index, field, value, meeting.id);
    }
  };

  const handleAddTaskToAgenda = (itemIndex: number, task: any) => {
    addTaskToAgenda(itemIndex, task);
    setShowTaskSelector(null);
  };

  const isActiveMeeting = activeMeeting?.id === meeting.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {isActiveMeeting ? "🟢 Aktive Meeting-Agenda" : "Meeting-Agenda"}
          </span>
          {!isActiveMeeting && (
            <div className="flex gap-2">
              <Button onClick={addAgendaItem} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Punkt hinzufügen
              </Button>
              <Button onClick={() => meeting.id && saveAgendaItems(meeting.id)} size="sm">
                <Save className="h-4 w-4 mr-1" />
                Speichern
              </Button>
            </div>
          )}
        </CardTitle>
        <CardDescription>
          {meeting.title} - Agenda verwalten
          {isActiveMeeting && " (Live-Modus)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isActiveMeeting ? (
          // Active meeting view (no drag & drop)
          <div className="space-y-4">
            {agendaItems.map((item, index) => (
              <AgendaItem
                key={item.localKey || `item-${index}`}
                item={item}
                index={index}
                profiles={profiles}
                activeMeeting={true}
                onUpdate={handleUpdateAgendaItem}
                onDelete={deleteAgendaItem}
                onAddSubItem={addSubItem}
                onAddTask={(itemIndex) => setShowTaskSelector({ itemIndex })}
              />
            ))}
          </div>
        ) : (
          // Edit mode with drag & drop
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="agenda-items">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {agendaItems.map((item, index) => (
                    <AgendaItem
                      key={item.localKey || `item-${index}`}
                      item={item}
                      index={index}
                      profiles={profiles}
                      activeMeeting={false}
                      onUpdate={handleUpdateAgendaItem}
                      onDelete={deleteAgendaItem}
                      onAddSubItem={addSubItem}
                      onAddTask={(itemIndex) => setShowTaskSelector({ itemIndex })}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {agendaItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Noch keine Agenda-Punkte vorhanden.</p>
            {!isActiveMeeting && (
              <Button onClick={addAgendaItem} className="mt-4">
                Ersten Punkt hinzufügen
              </Button>
            )}
          </div>
        )}

        {/* Task Selector Dialog */}
        <Dialog open={!!showTaskSelector} onOpenChange={() => setShowTaskSelector(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aufgabe zur Agenda hinzufügen</DialogTitle>
              <DialogDescription>
                Wählen Sie eine Aufgabe aus, die als Unterpunkt hinzugefügt werden soll.
              </DialogDescription>
            </DialogHeader>
            {showTaskSelector && (
              <TaskSelector
                tasks={tasks}
                taskDocuments={taskDocuments}
                onSelectTask={(task) => handleAddTaskToAgenda(showTaskSelector.itemIndex, task)}
                onClose={() => setShowTaskSelector(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
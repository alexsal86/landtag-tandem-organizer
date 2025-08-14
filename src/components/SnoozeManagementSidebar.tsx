import React, { useState } from 'react';
import { X, AlarmClock, Calendar, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SnoozeItem {
  id: string;
  task_id?: string;
  subtask_id?: string;
  snoozed_until: string;
  task_title?: string;
  subtask_description?: string;
}

interface SnoozeManagementSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  snoozes: SnoozeItem[];
  onUpdateSnooze: (snoozeId: string, newDate: string) => void;
  onDeleteSnooze: (snoozeId: string) => void;
  hideSnoozeSubtasks: boolean;
  onToggleHideSnoozeSubtasks: (hide: boolean) => void;
}

export function SnoozeManagementSidebar({ 
  isOpen, 
  onClose, 
  snoozes, 
  onUpdateSnooze, 
  onDeleteSnooze,
  hideSnoozeSubtasks,
  onToggleHideSnoozeSubtasks
}: SnoozeManagementSidebarProps) {
  const [editingSnooze, setEditingSnooze] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');

  const handleEdit = (snooze: SnoozeItem) => {
    setEditingSnooze(snooze.id);
    const date = new Date(snooze.snoozed_until);
    const formattedDate = date.toISOString().slice(0, 16);
    setEditDate(formattedDate);
  };

  const handleSaveEdit = () => {
    if (editingSnooze && editDate) {
      const newDate = new Date(editDate).toISOString();
      onUpdateSnooze(editingSnooze, newDate);
      setEditingSnooze(null);
      setEditDate('');
    }
  };

  const handleCancelEdit = () => {
    setEditingSnooze(null);
    setEditDate('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full w-96 bg-background border-l shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlarmClock className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Wiedervorlagen verwalten</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Display Options */}
          <div className="border-b pb-4 mb-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-snooze-subtasks" className="text-sm font-medium">
                Wiedervorlagen in Unteraufgaben ausblenden
              </Label>
              <Switch
                id="hide-snooze-subtasks"
                checked={hideSnoozeSubtasks}
                onCheckedChange={onToggleHideSnoozeSubtasks}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hideSnoozeSubtasks 
                ? "Wiedervorgelagte Unteraufgaben werden komplett ausgeblendet" 
                : "Wiedervorgelagte Unteraufgaben werden mit reduzierter Opazität angezeigt"
              }
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {snoozes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlarmClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Wiedervorlagen vorhanden</p>
              </div>
            ) : (
              snoozes.map((snooze) => (
                <Card key={snooze.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="mb-2">
                          {snooze.task_id ? 'Aufgabe' : 'Unteraufgabe'}
                        </Badge>
                        <h3 className="font-medium text-sm line-clamp-2">
                          {snooze.task_title || snooze.subtask_description}
                        </h3>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(snooze)}
                          className="h-8 w-8 p-0"
                          title="Bearbeiten"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteSnooze(snooze.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Löschen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {editingSnooze === snooze.id ? (
                      <div className="space-y-3">
                        <div>
                          <Input
                            type="datetime-local"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            Speichern
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Bis: {formatDate(snooze.snoozed_until)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
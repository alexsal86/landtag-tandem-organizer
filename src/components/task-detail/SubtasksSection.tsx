import React from "react";
import { ListTodo, Plus, Edit2, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import type { Subtask } from "./types";
import { formatDate } from "./types";

interface SubtasksSectionProps {
  subtasks: Subtask[];
  users: Array<{ user_id: string; display_name?: string }>;
  newSubtask: { description: string; assigned_to: string; due_date: string };
  setNewSubtask: React.Dispatch<React.SetStateAction<{ description: string; assigned_to: string; due_date: string }>>;
  editingSubtask: Record<string, Partial<Subtask>>;
  setEditingSubtask: React.Dispatch<React.SetStateAction<Record<string, Partial<Subtask>>>>;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Subtask>) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function SubtasksSection({
  subtasks, users, newSubtask, setNewSubtask,
  editingSubtask, setEditingSubtask,
  onAdd, onUpdate, onToggle, onDelete,
}: SubtasksSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4" />
        <h3 className="font-medium">Unteraufgaben ({subtasks.length})</h3>
      </div>

      {/* Add new subtask */}
      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
        <div>
          <Label>Beschreibung</Label>
          <Input placeholder="Neue Unteraufgabe..." value={newSubtask.description} onChange={(e) => setNewSubtask((p) => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Zuständig</Label>
            <MultiSelect
              options={users.map((u) => ({ value: u.user_id, label: u.display_name || `User ${u.user_id.slice(0, 8)}` }))}
              selected={newSubtask.assigned_to ? newSubtask.assigned_to.split(",").map((s) => s.trim()).filter(Boolean) : []}
              onChange={(sel) => setNewSubtask((p) => ({ ...p, assigned_to: sel.join(", ") }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Fällig</Label>
            <Input type="date" value={newSubtask.due_date} onChange={(e) => setNewSubtask((p) => ({ ...p, due_date: e.target.value }))} />
          </div>
        </div>
        <Button onClick={onAdd} size="sm" disabled={!newSubtask.description.trim()} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Unteraufgabe hinzufügen
        </Button>
      </div>

      {/* Existing subtasks */}
      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="p-3 bg-muted/30 rounded-lg">
            {editingSubtask[subtask.id] ? (
              <div className="space-y-3">
                <Input
                  value={editingSubtask[subtask.id]?.description || subtask.title || subtask.description}
                  onChange={(e) => setEditingSubtask((p) => ({ ...p, [subtask.id]: { ...p[subtask.id], description: e.target.value } }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <MultiSelect
                    options={users.map((u) => ({ value: u.user_id, label: u.display_name || `User ${u.user_id.slice(0, 8)}` }))}
                    selected={(() => { const v = editingSubtask[subtask.id]?.assigned_to || subtask.assigned_to || ""; return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []; })()}
                    onChange={(sel) => setEditingSubtask((p) => ({ ...p, [subtask.id]: { ...p[subtask.id], assigned_to: sel.join(", ") } }))}
                    placeholder="Zuständig"
                  />
                  <Input
                    type="date"
                    value={editingSubtask[subtask.id]?.due_date || (subtask.due_date ? subtask.due_date.split("T")[0] : "")}
                    onChange={(e) => setEditingSubtask((p) => ({ ...p, [subtask.id]: { ...p[subtask.id], due_date: e.target.value } }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onUpdate(subtask.id, editingSubtask[subtask.id])}>
                    <Check className="h-4 w-4 mr-1" />Speichern
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingSubtask((p) => { const u = { ...p }; delete u[subtask.id]; return u; })}>
                    <X className="h-4 w-4 mr-1" />Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={subtask.is_completed} onChange={(e) => onToggle(subtask.id, e.target.checked)} className="mt-0.5" />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${subtask.is_completed ? "line-through text-muted-foreground" : ""}`}>{subtask.title || subtask.description}</p>
                  {subtask.is_completed && subtask.result_text && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Ergebnis:</p>
                      <p className="text-sm text-green-800 dark:text-green-200">{subtask.result_text}</p>
                      {subtask.completed_at && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Erledigt am: {new Date(subtask.completed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {subtask.assigned_to?.trim() && (
                      <span>Zuständig: {subtask.assigned_to.split(",").map((id) => users.find((u) => u.user_id === id.trim())?.display_name || id.trim()).join(", ")}</span>
                    )}
                    {subtask.due_date && <span>Fällig: {formatDate(subtask.due_date)}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingSubtask((p) => ({ ...p, [subtask.id]: { description: subtask.title || subtask.description, assigned_to: subtask.assigned_to, due_date: subtask.due_date } }))}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(subtask.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {subtasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Noch keine Unteraufgaben erstellt</p>}
      </div>
    </div>
  );
}

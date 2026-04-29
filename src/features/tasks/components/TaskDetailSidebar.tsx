import { X, Save, Calendar, Flag, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { useTaskDetailData } from "./task-detail/useTaskDetailData";
import { SubtasksSection } from "./task-detail/SubtasksSection";
import { DocumentsSection } from "./task-detail/DocumentsSection";
import { CommentsSection } from "./task-detail/CommentsSection";
import { getPriorityColor, getCategoryColor, formatDate } from "./task-detail/types";
import type { Task, TaskDetailSidebarProps } from "./task-detail/types";

export function TaskDetailSidebar({ task, isOpen, onClose, onTaskUpdate, onTaskRestored, taskCategories, taskStatuses }: TaskDetailSidebarProps) {
  const d = useTaskDetailData(task);

  if (!task) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-96 bg-background border-l shadow-xl z-50 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Aufgaben-Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Task Info */}
          <div className="space-y-4">
            <div>
              <Label>Titel</Label>
              <Input value={d.editFormData.title || ""} onChange={(e) => d.setEditFormData((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <SimpleRichTextEditor initialContent={d.editFormData.description || ""} onChange={(html) => d.setEditFormData((p) => ({ ...p, description: html }))} placeholder="Beschreibung eingeben..." minHeight="80px" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priorität</Label>
                <Select value={d.editFormData.priority} onValueChange={(v) => d.setEditFormData((p) => ({ ...p, priority: v as Task["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={d.editFormData.status} onValueChange={(v) => d.setEditFormData((p) => ({ ...p, status: v as Task["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskStatuses.map((s) => <SelectItem key={s.name} value={s.name}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={d.editFormData.category} onValueChange={(v) => d.setEditFormData((p) => ({ ...p, category: v as Task["category"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskCategories.map((c) => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input type="date" value={d.editFormData.dueDate ? d.editFormData.dueDate.split("T")[0] : ""} onChange={(e) => d.setEditFormData((p) => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Zugewiesen an</Label>
              <MultiSelect
                options={d.users.map((u) => ({ value: u.user_id, label: u.display_name || `User ${u.user_id.slice(0, 8)}` }))}
                selected={d.editFormData.assignedTo ? d.editFormData.assignedTo.split(",").map((s) => s.trim()).filter(Boolean) : []}
                onChange={(sel) => d.setEditFormData((p) => ({ ...p, assignedTo: sel.length > 0 ? sel.join(", ") : "" }))}
                placeholder="Personen auswählen..."
              />
            </div>

            <div>
              <Label>Fortschritt (%)</Label>
              <Input type="number" min="0" max="100" value={d.editFormData.progress || ""} onChange={(e) => d.setEditFormData((p) => ({ ...p, progress: parseInt(e.target.value) || 0 }))} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className={getPriorityColor(task.priority)} variant="secondary">
                <Flag className="h-3 w-3 mr-1" />
                {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
              </Badge>
              <Badge className={getCategoryColor(task.category)} variant="secondary">
                <Tag className="h-3 w-3 mr-1" />
                {taskCategories.find((c) => c.name === task.category)?.label || task.category}
              </Badge>
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(task.dueDate)}
              </Badge>
            </div>

            <Button onClick={() => d.handleSave(onTaskUpdate)} disabled={d.saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {d.saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>

          <Separator />

          <SubtasksSection
            subtasks={d.subtasks}
            users={d.users}
            newSubtask={d.newSubtask}
            setNewSubtask={d.setNewSubtask}
            editingSubtask={d.editingSubtask}
            setEditingSubtask={d.setEditingSubtask}
            onAdd={d.addSubtask}
            onUpdate={d.updateSubtask}
            onToggle={d.toggleSubtaskComplete}
            onDelete={d.deleteSubtask}
          />

          <Separator />

          <DocumentsSection
            documents={d.taskDocuments}
            uploading={d.uploading}
            currentUserId={d.user?.id}
            onUpload={d.handleFileUpload}
            onDownload={d.downloadDocument}
            onDelete={d.deleteDocument}
          />

          <Separator />

          <CommentsSection
            comments={d.comments}
            newComment={d.newComment}
            setNewComment={d.setNewComment}
            newCommentEditorKey={d.newCommentEditorKey}
            editingComment={d.editingComment}
            setEditingComment={d.setEditingComment}
            currentUserId={d.user?.id}
            onAdd={d.addComment}
            onUpdate={d.updateComment}
            onDelete={d.deleteComment}
          />
        </div>
      </div>
    </div>
  );
}

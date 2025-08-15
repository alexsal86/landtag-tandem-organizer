import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash, Plus, Upload, Download, FileText, X } from "lucide-react";
import { AgendaItem as AgendaItemType, AgendaDocument, Profile } from "@/types/meeting";
import { useMeetingDocuments } from "@/hooks/useMeetingDocuments";
import { useAuth } from "@/hooks/useAuth";

interface AgendaItemProps {
  item: AgendaItemType;
  index: number;
  profiles: Profile[];
  activeMeeting?: boolean;
  onUpdate: (index: number, field: keyof AgendaItemType, value: any) => void;
  onDelete: (index: number) => void;
  onAddSubItem: (parentIndex: number) => void;
  onAddTask: (itemIndex: number) => void;
}

export function AgendaItem({ 
  item, 
  index, 
  profiles, 
  activeMeeting = false,
  onUpdate, 
  onDelete, 
  onAddSubItem, 
  onAddTask 
}: AgendaItemProps) {
  const { user } = useAuth();
  const { agendaDocuments, uploadAgendaDocument, downloadAgendaDocument, deleteAgendaDocument } = useMeetingDocuments();
  const [isUploading, setIsUploading] = useState(false);
  
  const itemDocuments = item.id ? agendaDocuments[item.id] || [] : [];
  const isSubItem = Boolean(item.parentLocalKey);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !item.id || !user) return;

    setIsUploading(true);
    try {
      // Upload multiple files
      for (const file of Array.from(files)) {
        await uploadAgendaDocument(item.id, file, user.id);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const renderDocuments = () => {
    if (!item.id || itemDocuments.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Angehängte Dateien ({itemDocuments.length})
        </div>
        <div className="grid gap-2">
          {itemDocuments.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate" title={doc.file_name}>
                  {doc.file_name}
                </span>
                {doc.file_size && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    ({Math.round(doc.file_size / 1024)} KB)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadAgendaDocument(doc)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAgendaDocument(doc.id, doc.meeting_agenda_item_id, doc.file_path)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (activeMeeting) {
    return (
      <div className={`p-4 border rounded-lg ${isSubItem ? 'ml-8 border-l-4 border-l-primary/50' : ''}`}>
        <div className="flex items-start gap-3">
          <Checkbox
            checked={item.is_completed}
            onCheckedChange={(checked) => onUpdate(index, 'is_completed', checked)}
            className="mt-1"
          />
          <div className="flex-1 space-y-3">
            <h4 className="font-medium">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}
            {item.assigned_to && item.assigned_to !== 'unassigned' && (
              <Badge variant="secondary">
                {profiles.find(p => p.user_id === item.assigned_to)?.display_name || item.assigned_to}
              </Badge>
            )}
            {item.task_id && (
              <Badge variant="outline">Von Aufgabe</Badge>
            )}
            
            <div className="space-y-2">
              <Textarea
                placeholder="Ergebnis dokumentieren..."
                value={item.result_text || ""}
                onChange={(e) => onUpdate(index, 'result_text', e.target.value)}
                className="min-h-[80px]"
              />
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`carry-over-${index}`}
                  checked={item.carry_over_to_next || false}
                  onCheckedChange={(checked) => onUpdate(index, 'carry_over_to_next', checked)}
                />
                <label htmlFor={`carry-over-${index}`} className="text-sm">
                  In nächstes Meeting übertragen
                </label>
              </div>
            </div>

            {renderDocuments()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Draggable draggableId={item.localKey || `item-${index}`} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`p-4 border rounded-lg bg-card ${isSubItem ? 'ml-8 border-l-4 border-l-primary/50' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div
              {...provided.dragHandleProps}
              className="text-muted-foreground hover:text-foreground cursor-grab mt-1"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Agenda-Punkt"
                  value={item.title}
                  onChange={(e) => onUpdate(index, 'title', e.target.value)}
                />
                <Select 
                  value={item.assigned_to || "unassigned"} 
                  onValueChange={(value) => onUpdate(index, 'assigned_to', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Zuweisen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.user_id} value={profile.user_id}>
                        {profile.display_name || 'Unbekannt'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                placeholder="Beschreibung (optional)"
                value={item.description || ""}
                onChange={(e) => onUpdate(index, 'description', e.target.value)}
                className="min-h-[80px]"
              />

              <Textarea
                placeholder="Notizen"
                value={item.notes || ""}
                onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                className="min-h-[60px]"
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={item.is_completed}
                  onCheckedChange={(checked) => onUpdate(index, 'is_completed', checked)}
                />
                <span className="text-sm">Abgeschlossen</span>
                
                <Checkbox
                  checked={item.is_recurring}
                  onCheckedChange={(checked) => onUpdate(index, 'is_recurring', checked)}
                />
                <span className="text-sm">Wiederkehrend</span>
              </div>

              {item.task_id && (
                <Badge variant="outline" className="w-fit">
                  Von Aufgabe verknüpft
                </Badge>
              )}

              {/* File Upload Section */}
              {item.id && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id={`file-upload-${item.id}`}
                      accept="*/*"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById(`file-upload-${item.id}`)?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? 'Hochladen...' : 'Dateien hinzufügen'}
                    </Button>
                  </div>
                  
                  {renderDocuments()}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!isSubItem && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => onAddSubItem(index)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Unterpunkt
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onAddTask(index)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Aufgabe
                    </Button>
                  </>
                )}
                <Button variant="destructive" size="sm" onClick={() => onDelete(index)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
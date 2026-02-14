import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, MessageCircle, Paperclip, ListTodo, Mail, Download, Edit2, X } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { ChecklistItem, PlanningSubtask, PlanningComment, PlanningDocument, Profile } from "./types";

interface ChecklistSectionProps {
  checklistItems: ChecklistItem[];
  newChecklistItem: string;
  setNewChecklistItem: (value: string) => void;
  onDragEnd: (result: DropResult) => void;
  toggleChecklistItem: (itemId: string, isCompleted: boolean) => void;
  updateChecklistItemTitle: (itemId: string, title: string) => void;
  addChecklistItem: () => void;
  deleteChecklistItem: (itemId: string) => void;
  itemSubtasks: { [itemId: string]: PlanningSubtask[] };
  itemComments: { [itemId: string]: PlanningComment[] };
  itemDocuments: { [itemId: string]: PlanningDocument[] };
  showItemSubtasks: { [itemId: string]: boolean };
  setShowItemSubtasks: (value: { [itemId: string]: boolean } | ((prev: { [itemId: string]: boolean }) => { [itemId: string]: boolean })) => void;
  showItemComments: { [itemId: string]: boolean };
  setShowItemComments: (value: { [itemId: string]: boolean } | ((prev: { [itemId: string]: boolean }) => { [itemId: string]: boolean })) => void;
  showItemDocuments: { [itemId: string]: boolean };
  setShowItemDocuments: (value: { [itemId: string]: boolean } | ((prev: { [itemId: string]: boolean }) => { [itemId: string]: boolean })) => void;
  allProfiles: Profile[];
  user: any;
  uploading: boolean;
  itemEmailActions: Record<string, any>;
  editingComment: { [commentId: string]: string };
  setEditingComment: (value: any) => void;
  addItemSubtask: (description?: string, assignedTo?: string, dueDate?: string, itemId?: string) => void;
  addItemCommentForItem: (itemId: string, comment: string) => void;
  handleItemFileUpload: (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => void;
  deleteItemDocument: (doc: PlanningDocument) => void;
  downloadItemDocument: (doc: PlanningDocument) => void;
  deleteItemComment: (comment: PlanningComment) => void;
  updateItemComment: (commentId: string, newContent: string) => void;
  setCompletingSubtask: (id: string | null) => void;
  setCompletionResult: (value: string) => void;
  loadItemSubtasks: (itemId: string) => void;
  loadAllItemCounts: () => void;
  setEmailDialogOpen: (open: boolean) => void;
  setSelectedEmailItemId: (id: string | null) => void;
  // Legacy sub-items
  toggleSubItem: (itemId: string, subItemIndex: number, isCompleted: boolean) => void;
  updateSubItemTitle: (itemId: string, subItemIndex: number, title: string) => void;
  removeSubItem: (itemId: string, subItemIndex: number) => void;
}

export function ChecklistSection(props: ChecklistSectionProps) {
  const {
    checklistItems, newChecklistItem, setNewChecklistItem,
    onDragEnd, toggleChecklistItem, updateChecklistItemTitle, addChecklistItem, deleteChecklistItem,
    itemSubtasks, itemComments, itemDocuments,
    showItemSubtasks, setShowItemSubtasks, showItemComments, setShowItemComments,
    showItemDocuments, setShowItemDocuments,
    allProfiles, user, uploading, itemEmailActions,
    editingComment, setEditingComment,
    addItemSubtask, addItemCommentForItem,
    handleItemFileUpload, deleteItemDocument, downloadItemDocument,
    deleteItemComment, updateItemComment,
    setCompletingSubtask, setCompletionResult,
    loadItemSubtasks, loadAllItemCounts,
    setEmailDialogOpen, setSelectedEmailItemId,
    toggleSubItem, updateSubItemTitle, removeSubItem,
  } = props;

  return (
    <Card className="lg:col-span-2 bg-card shadow-card border-border">
      <CardHeader>
        <CardTitle>Checkliste</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="checklist">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {checklistItems.map((item: any, index: number) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} className={cn("group", snapshot.isDragging && "z-50")}>
                          {item.type === 'separator' ? (
                            <div className="flex items-center gap-2 py-3 group">
                              <div {...provided.dragHandleProps} className="text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
                              <div className="flex-1 border-t border-dashed border-border"></div>
                              <Input value={item.title || 'Trenner'} onChange={(e) => updateChecklistItemTitle(item.id, e.target.value)} className="text-muted-foreground italic text-sm px-2 border-none bg-transparent text-center w-32" placeholder="Trenner-Text eingeben..." />
                              <div className="flex-1 border-t border-dashed border-border"></div>
                              <Button variant="ghost" size="sm" onClick={() => deleteChecklistItem(item.id)} className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Trenner löschen">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 p-3 border border-border rounded-md bg-background hover:bg-muted/50 transition-colors">
                                <div {...provided.dragHandleProps} className="text-muted-foreground cursor-grab"><GripVertical className="h-4 w-4" /></div>
                                <Checkbox checked={item.is_completed} onCheckedChange={() => toggleChecklistItem(item.id, item.is_completed)} />
                                <Input value={item.title} onChange={(e) => updateChecklistItemTitle(item.id, e.target.value)} className={cn("flex-1 border-none bg-transparent focus:bg-background text-sm", item.is_completed && "line-through text-muted-foreground")} />
                                
                                {/* Action buttons */}
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 relative" onClick={() => setShowItemSubtasks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                                    <ListTodo className="h-3 w-3" />
                                    {(itemSubtasks[item.id]?.length || 0) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{itemSubtasks[item.id]?.length}</span>}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 relative" onClick={() => setShowItemComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                                    <MessageCircle className="h-3 w-3" />
                                    {(itemComments[item.id]?.length || 0) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{itemComments[item.id]?.length}</span>}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 relative" onClick={() => setShowItemDocuments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                                    <Paperclip className="h-3 w-3" />
                                    {(itemDocuments[item.id]?.length || 0) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{itemDocuments[item.id]?.length}</span>}
                                  </Button>
                                  <Button variant="ghost" size="sm" className={cn("h-6 w-6 p-0", itemEmailActions[item.id]?.is_enabled && "text-blue-500")} onClick={() => { setSelectedEmailItemId(item.id); setEmailDialogOpen(true); }}>
                                    <Mail className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteChecklistItem(item.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded Subtasks */}
                              {showItemSubtasks[item.id] && (
                                <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                  <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                    <ListTodo className="h-4 w-4" />Unteraufgaben
                                  </div>
                                  {itemSubtasks[item.id]?.map((subtask) => (
                                    <div key={subtask.id} className="space-y-2 p-2 border border-border rounded bg-muted/30">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox checked={subtask.is_completed} onCheckedChange={(checked) => {
                                          if (checked) { setCompletingSubtask(subtask.id); setCompletionResult(''); }
                                          else { supabase.from('planning_item_subtasks').update({ is_completed: false, result_text: null, completed_at: null }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); loadAllItemCounts(); }); }
                                        }} />
                                        <Input value={subtask.description} onChange={(e) => { supabase.from('planning_item_subtasks').update({ description: e.target.value }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); }); }}
                                          className={cn("flex-1 text-sm border-none bg-transparent focus:bg-background", subtask.is_completed && "line-through text-muted-foreground")} />
                                        <Select value={subtask.assigned_to || 'unassigned'} onValueChange={(value) => { supabase.from('planning_item_subtasks').update({ assigned_to: value === 'unassigned' ? null : value }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); }); }}>
                                          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Zuweisen..." /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="unassigned">Niemand</SelectItem>
                                            {allProfiles.map((profile) => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.display_name || 'Unbekannt'}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                        <Input type="date" value={subtask.due_date ? format(new Date(subtask.due_date), "yyyy-MM-dd") : ''} onChange={(e) => { supabase.from('planning_item_subtasks').update({ due_date: e.target.value || null }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); }); }} className="w-[130px] h-8 text-xs" placeholder="Frist..." />
                                        <Button variant="ghost" size="sm" onClick={() => { supabase.from('planning_item_subtasks').delete().eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); loadAllItemCounts(); }); }} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      {subtask.result_text && (
                                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-4 border-green-500">
                                          <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Ergebnis:</p>
                                          <p className="text-sm text-green-800 dark:text-green-200">{subtask.result_text}</p>
                                          {subtask.completed_at && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Abgeschlossen: {format(new Date(subtask.completed_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  <div className="space-y-2 pt-2">
                                    <Input placeholder="Neue Unteraufgabe..." className="text-sm" onKeyPress={(e) => { if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value.trim() && user) { addItemSubtask(input.value.trim(), 'unassigned', '', item.id); input.value = ''; } } }} />
                                    <div className="flex gap-2">
                                      <Select value="" onValueChange={(value) => { const description = (document.querySelector(`input[placeholder="Neue Unteraufgabe..."]`) as HTMLInputElement)?.value; if (description?.trim() && user) { const assignedTo = value === 'unassigned' ? '' : value; addItemSubtask(description.trim(), assignedTo, '', item.id); (document.querySelector(`input[placeholder="Neue Unteraufgabe..."]`) as HTMLInputElement).value = ''; } }}>
                                        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Schnell zuweisen..." /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unassigned">Niemand</SelectItem>
                                          {allProfiles.map((profile) => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.display_name || 'Unbekannt'}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Expanded Comments */}
                              {showItemComments[item.id] && (
                                <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                  <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground"><MessageCircle className="h-4 w-4" />Kommentare</div>
                                  {itemComments[item.id]?.map((comment) => (
                                    <div key={comment.id} className="p-2 border border-border rounded bg-muted/30">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs font-medium">{comment.profile?.display_name || 'Unbekannt'}</span>
                                          <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                                        </div>
                                        {comment.user_id === user?.id && (
                                          <div className="flex space-x-1">
                                            <Button variant="ghost" size="sm" onClick={() => setEditingComment((prev: any) => ({ ...prev, [comment.id]: comment.content }))} className="h-6 w-6 p-0"><Edit2 className="h-3 w-3" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => deleteItemComment(comment)} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                          </div>
                                        )}
                                      </div>
                                      {editingComment[comment.id] !== undefined ? (
                                        <div className="space-y-2">
                                          <Input value={editingComment[comment.id]} onChange={(e) => setEditingComment((prev: any) => ({ ...prev, [comment.id]: e.target.value }))} className="text-sm"
                                            onKeyPress={(e) => { if (e.key === 'Enter') updateItemComment(comment.id, editingComment[comment.id]); if (e.key === 'Escape') setEditingComment((prev: any) => { const ns = { ...prev }; delete ns[comment.id]; return ns; }); }} />
                                          <div className="flex space-x-2">
                                            <Button size="sm" onClick={() => updateItemComment(comment.id, editingComment[comment.id])} className="h-6 text-xs">Speichern</Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingComment((prev: any) => { const ns = { ...prev }; delete ns[comment.id]; return ns; })} className="h-6 text-xs">Abbrechen</Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-sm">{comment.content}</p>
                                      )}
                                    </div>
                                  ))}
                                  <div className="pt-2">
                                    <Input placeholder="Kommentar hinzufügen..." className="text-sm" onKeyPress={(e) => { if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value.trim()) { addItemCommentForItem(item.id, input.value); input.value = ''; } } }} />
                                  </div>
                                </div>
                              )}

                              {/* Expanded Documents */}
                              {showItemDocuments[item.id] && (
                                <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                  <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground"><Paperclip className="h-4 w-4" />Dokumente</div>
                                  {itemDocuments[item.id]?.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-2 border border-border rounded bg-muted/30">
                                      <div className="flex items-center space-x-2"><Paperclip className="h-3 w-3" /><span className="text-sm truncate">{doc.file_name}</span></div>
                                      <div className="flex space-x-1">
                                        <Button variant="ghost" size="sm" onClick={() => downloadItemDocument(doc)}><Download className="h-3 w-3" /></Button>
                                        <Button variant="ghost" size="sm" onClick={() => deleteItemDocument(doc)} className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="pt-2"><Input type="file" onChange={(e) => handleItemFileUpload(e, item.id)} className="text-sm" disabled={uploading} /></div>
                                </div>
                              )}

                              {/* Legacy sub-items */}
                              {item.sub_items && Array.isArray(item.sub_items) && item.sub_items.length > 0 && (
                                <div className="ml-12 space-y-1">
                                  {item.sub_items.map((subItem: any, index: number) => (
                                    <div key={index} className="flex items-center space-x-2">
                                      <Checkbox checked={subItem.is_completed || false} onCheckedChange={() => toggleSubItem(item.id, index, subItem.is_completed || false)} />
                                      <Input value={subItem.title || ''} onChange={(e) => updateSubItemTitle(item.id, index, e.target.value)} className={cn("flex-1 text-sm", subItem.is_completed && "line-through text-muted-foreground")} placeholder="Unterpunkt..." />
                                      <Button variant="ghost" size="sm" onClick={() => removeSubItem(item.id, index)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          <div className="flex items-center space-x-2 mt-4">
            <Input value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder="Neuen Punkt hinzufügen (--- für Trenner)..." onKeyPress={(e) => e.key === "Enter" && addChecklistItem()} />
            <Button onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

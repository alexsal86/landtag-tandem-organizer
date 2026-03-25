import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { MeetingTemplateParticipantsEditor } from "@/components/meetings/MeetingTemplateParticipantsEditor";
import { Plus, Save, X, Check, GripVertical, Minus, Edit, Trash2, CalendarDays, StickyNote, ListTodo, Cake, Scale, MoveVertical, ArrowUp, ArrowDown, CornerUpLeft } from "lucide-react";
import type { MeetingTemplateChildItem, MeetingTemplateItem, MeetingTemplateRecord } from "@/types/meetingTemplate";

export function MeetingTemplateManager() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplateRecord[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplateRecord | null>(null);
  const [templateItems, setTemplateItems] = useState<MeetingTemplateItem[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; field: string; value: string } | null>(null);
  const [newTemplateItem, setNewTemplateItem] = useState<{ title: string; parentIndex?: number } | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<{ id: string; value: string } | null>(null);
  const [editingChild, setEditingChild] = useState<{ parentIndex: number; childIndex: number; value: string } | null>(null);
  const [deletingChild, setDeletingChild] = useState<{ parentIndex: number; childIndex: number; title: string } | null>(null);
  const [childPopoverOpen, setChildPopoverOpen] = useState<number | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase.from('meeting_templates').select('*').order('name');
    if (!error) setMeetingTemplates(data || []);
  };

  const loadTemplate = (template: MeetingTemplateRecord) => {
    setSelectedTemplate(template);
    setTemplateItems(Array.isArray(template.template_items) ? template.template_items : []);
  };

  const createNewMeetingTemplate = async () => {
    if (!user) return;
    try {
      const newName = `Neues Template ${meetingTemplates.length + 1}`;
      const { data, error } = await supabase
        .from('meeting_templates')
        .insert([{ name: newName, description: '', template_items: [], default_participants: [], default_recurrence: null, auto_create_count: 3, is_default: false, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      setMeetingTemplates([...meetingTemplates, data as MeetingTemplateRecord]);
      loadTemplate(data as MeetingTemplateRecord);
      setEditingTemplateName({ id: data.id, value: data.name });
      toast({ title: "Template erstellt", description: "Neues Meeting-Template wurde angelegt." });
    } catch (error) {
      debugConsole.error('Error creating template:', error);
      toast({ title: "Fehler", description: "Template konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const saveTemplateItems = async (items: MeetingTemplateItem[] = templateItems, retryCount = 0): Promise<boolean> => {
    if (!selectedTemplate) return false;
    try {
      const { error } = await supabase.from('meeting_templates').update({ template_items: items }).eq('id', selectedTemplate.id);
      if (error) throw error;
      return true;
    } catch (error: unknown) {
      debugConsole.error('Save error:', error);
      const isNetworkError = (error instanceof Error && (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.message?.includes('network'))) || (error instanceof TypeError) || !navigator.onLine;
      if (retryCount < 2 && isNetworkError) {
        await new Promise(r => setTimeout(r, 500 * (retryCount + 1)));
        return saveTemplateItems(items, retryCount + 1);
      }
      toast({
        title: isNetworkError ? "Netzwerkfehler" : "Fehler",
        description: isNetworkError ? "Änderungen konnten nach mehreren Versuchen nicht gespeichert werden. Bitte erneut versuchen." : "Fehler beim Speichern.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDragEnd = (result: { destination: { index: number } | null; source: { index: number } }) => {
    if (!result.destination) return;
    const items = Array.from(templateItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updatedItems: MeetingTemplateItem[] = items.map((item, index) => ({ ...item, order_index: index }));
    setTemplateItems(updatedItems);
    saveTemplateItems(updatedItems);
  };

  const moveChildItem = (parentIndex: number, childIndex: number, direction: 'up' | 'down') => {
    const newItems = [...templateItems];
    const children = [...(newItems[parentIndex].children || [])];
    if (direction === 'up' && childIndex > 0) {
      [children[childIndex - 1], children[childIndex]] = [children[childIndex], children[childIndex - 1]];
    } else if (direction === 'down' && childIndex < children.length - 1) {
      [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1], children[childIndex]];
    } else return;
    newItems[parentIndex].children = children.map((c, i) => ({ ...c, order_index: i }));
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const updateChildItem = (parentIndex: number, childIndex: number, newTitle: string) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children?.[childIndex]) {
      newItems[parentIndex].children[childIndex].title = newTitle;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
    }
  };

  const confirmDeleteChild = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    newItems[parentIndex].children = (newItems[parentIndex].children || []).filter((_, i: number) => i !== childIndex);
    if (newItems[parentIndex].children.length === 0) delete newItems[parentIndex].children;
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
    setDeletingChild(null);
  };

  const makeChildAvailable = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children?.[childIndex]) {
      newItems[parentIndex].children[childIndex].is_available = true;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
    }
  };

  const activateChild = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children?.[childIndex]) {
      newItems[parentIndex].children[childIndex].is_available = false;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
      setChildPopoverOpen(null);
    }
  };

  const toggleChildOptional = (parentIndex: number, childIndex: number) => {
    const newItems = [...templateItems];
    if (newItems[parentIndex].children?.[childIndex]) {
      newItems[parentIndex].children[childIndex].is_optional = !newItems[parentIndex].children[childIndex].is_optional;
      setTemplateItems(newItems);
      saveTemplateItems(newItems);
    }
  };

  const getTitleForSystemType = (systemType: string) => {
    switch (systemType) {
      case 'upcoming_appointments': return 'Kommende Termine';
      case 'quick_notes': return 'Meine Notizen';
      case 'tasks': return 'Aufgaben';
      case 'birthdays': return 'Geburtstage';
      case 'decisions': return 'Entscheidungen';
      default: return systemType;
    }
  };

  const addTemplateItem = (title: string, parentIndex?: number) => {
    if (!selectedTemplate) return false;
    const newItems = [...templateItems];
    if (parentIndex !== undefined) {
      if (!newItems[parentIndex].children) newItems[parentIndex].children = [];
      newItems[parentIndex].children.push({ title, order_index: newItems[parentIndex].children.length });
    } else {
      const itemType = title.startsWith('---') ? 'separator' : 'item';
      newItems.push({ title: itemType === 'separator' ? title.replace(/^---\s*/, '') : title, type: itemType, order_index: newItems.length });
    }
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
    setNewTemplateItem(null);
  };

  const addSystemTemplateItem = (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays' | 'decisions', parentIndex?: number) => {
    if (!selectedTemplate) return false;
    const existsInMain = templateItems.find(item => item.system_type === systemType);
    const existsInChildren = templateItems.some(item => item.children?.some((child) => child.system_type === systemType));
    if (existsInMain || existsInChildren) {
      toast({ title: "Bereits vorhanden", description: `"${getTitleForSystemType(systemType)}" ist bereits in der Agenda.`, variant: "destructive" });
      return;
    }
    const title = getTitleForSystemType(systemType);
    const newItems = [...templateItems];
    if (parentIndex !== undefined) {
      if (!newItems[parentIndex].children) newItems[parentIndex].children = [];
      newItems[parentIndex].children.push({ title, type: 'system', system_type: systemType, order_index: newItems[parentIndex].children.length });
    } else {
      newItems.push({ title, type: 'system', system_type: systemType, order_index: newItems.length });
    }
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const moveSystemItem = (fromMain: boolean, fromIndex: number, fromChildIndex: number | null, toParentIndex: number | null) => {
    const newItems = [...templateItems];
    let movedItem: MeetingTemplateItem | MeetingTemplateChildItem;
    if (fromMain && fromChildIndex === null) {
      [movedItem] = newItems.splice(fromIndex, 1);
    } else if (!fromMain && fromChildIndex !== null) {
      movedItem = newItems[fromIndex].children!.splice(fromChildIndex, 1)[0];
      if (newItems[fromIndex].children!.length === 0) delete newItems[fromIndex].children;
    } else return;
    if (toParentIndex !== null) {
      if (!newItems[toParentIndex].children) newItems[toParentIndex].children = [];
      movedItem.order_index = newItems[toParentIndex].children.length;
      newItems[toParentIndex].children.push(movedItem);
    } else {
      movedItem.order_index = newItems.length;
      newItems.push(movedItem);
    }
    const reindexedItems = newItems.map((item, idx) => ({
      ...item, order_index: idx,
      children: item.children?.map((child, childIdx: number) => ({ ...child, order_index: childIdx }))
    }));
    setTemplateItems(reindexedItems);
    saveTemplateItems(reindexedItems);
    toast({ title: "Verschoben", description: "Element wurde erfolgreich verschoben." });
  };

  const addSeparator = () => {
    if (!selectedTemplate) return false;
    const newItems = [...templateItems];
    newItems.push({ title: '', type: 'separator', order_index: newItems.length });
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const updateTemplateItem = (index: number, field: string, value: string) => {
    const newItems = [...templateItems];
    newItems[index][field] = value;
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const deleteTemplateItem = (index: number) => {
    const newItems = templateItems.filter((_, i) => i !== index);
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
  };

  const getSystemIcon = (systemType: string) => {
    switch (systemType) {
      case 'upcoming_appointments': return <CalendarDays className="h-4 w-4 text-blue-600" />;
      case 'quick_notes': return <StickyNote className="h-4 w-4 text-amber-600" />;
      case 'tasks': return <ListTodo className="h-4 w-4 text-green-600" />;
      case 'birthdays': return <Cake className="h-4 w-4 text-pink-600" />;
      case 'decisions': return <Scale className="h-4 w-4 text-violet-600" />;
      default: return null;
    }
  };

  const getSystemItemClass = (systemType: string) => {
    switch (systemType) {
      case 'upcoming_appointments': return 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
      case 'quick_notes': return 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20';
      case 'tasks': return 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20';
      case 'birthdays': return 'border-l-4 border-l-pink-500 bg-pink-50/50 dark:bg-pink-950/20';
      case 'decisions': return 'border-l-4 border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20';
      default: return '';
    }
  };

  const getChildSystemClass = (systemType: string) => {
    switch (systemType) {
      case 'upcoming_appointments': return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
      case 'tasks': return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
      case 'birthdays': return 'bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800';
      case 'decisions': return 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800';
      default: return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
    }
  };

  const getSmallIcon = (systemType: string, size = "h-3 w-3") => {
    switch (systemType) {
      case 'upcoming_appointments': return <CalendarDays className={`${size} text-blue-600 shrink-0`} />;
      case 'quick_notes': return <StickyNote className={`${size} text-amber-600 shrink-0`} />;
      case 'tasks': return <ListTodo className={`${size} text-green-600 shrink-0`} />;
      case 'birthdays': return <Cake className={`${size} text-pink-600 shrink-0`} />;
      case 'decisions': return <Scale className={`${size} text-violet-600 shrink-0`} />;
      default: return null;
    }
  };

  return (
    <>
      <AlertDialog open={!!deletingChild} onOpenChange={(open) => !open && setDeletingChild(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unterpunkt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Unterpunkt "{deletingChild?.title}" wirklich permanent löschen?
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingChild) confirmDeleteChild(deletingChild.parentIndex, deletingChild.childIndex); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Meeting Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
            {/* LEFT SIDEBAR */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Template auswählen</label>
                <Select
                  value={selectedTemplate?.id || ""}
                  onValueChange={(value) => {
                    if (value === "__new__") createNewMeetingTemplate();
                    else {
                      const template = meetingTemplates.find(t => t.id === value);
                      if (template) loadTemplate(template);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__" className="text-primary font-medium">
                      <span className="flex items-center gap-2"><Plus className="h-4 w-4" />Neues Template erstellen</span>
                    </SelectItem>
                    {meetingTemplates.length > 0 && <Separator className="my-1" />}
                    {meetingTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}{template.is_default && " ⭐"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <>
                  <div className="border-t pt-4">
                    <label className="text-xs text-muted-foreground mb-2 block">Template-Name</label>
                    <div className="flex items-center gap-2">
                      {editingTemplateName?.id === selectedTemplate.id ? (
                        <>
                          <Input value={editingTemplateName!.value} onChange={(e) => setEditingTemplateName({ id: editingTemplateName!.id, value: e.target.value })} className="flex-1 h-8 text-sm" />
                          <Button size="sm" className="h-8 w-8 p-0" onClick={async () => {
                            try {
                              const { error } = await supabase.from('meeting_templates').update({ name: editingTemplateName!.value }).eq('id', selectedTemplate.id);
                              if (error) throw error;
                              setSelectedTemplate({ ...selectedTemplate, name: editingTemplateName!.value });
                              await loadTemplates();
                              setEditingTemplateName(null);
                              toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
                            } catch { toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" }); }
                          }}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditingTemplateName(null)}><X className="h-3 w-3" /></Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium flex-1 truncate">{selectedTemplate.name}</span>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingTemplateName({ id: selectedTemplate.id, value: selectedTemplate.name })}><Edit className="h-3 w-3" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <MeetingTemplateParticipantsEditor
                      templateId={selectedTemplate.id}
                      defaultParticipants={selectedTemplate.default_participants as any || []}
                      defaultRecurrence={selectedTemplate.default_recurrence as any || null}
                      autoCreateCount={selectedTemplate.auto_create_count || 3}
                      compact
                      onSave={async (participants, recurrence, autoCreateCount, visibility) => {
                        try {
                          const normalizedParticipants = participants as Record<string, unknown>[];
                          const normalizedRecurrence = recurrence as Record<string, unknown> | null;
                          await supabase.from('meeting_templates').update({
                            default_participants: normalizedParticipants,
                            default_recurrence: normalizedRecurrence,
                            auto_create_count: autoCreateCount || 3,
                            default_visibility: visibility || 'private'
                          }).eq('id', selectedTemplate.id);
                          setSelectedTemplate({ ...selectedTemplate, default_participants: normalizedParticipants, default_recurrence: normalizedRecurrence, auto_create_count: autoCreateCount, default_visibility: visibility });
                        } catch { toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" }); }
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* RIGHT SIDE: AGENDA */}
            <div className="space-y-4">
              {selectedTemplate ? (
                <>
                  <h3 className="text-lg font-semibold">Tagesordnung</h3>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="template-items">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {templateItems.map((item, index) => (
                            <Draggable key={index} draggableId={index.toString()} index={index}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} className="space-y-1">
                                  <div className={`flex items-center gap-2 p-2 bg-card rounded border ${item.type === 'system' ? getSystemItemClass(item.system_type) : ''}`}>
                                    <div {...provided.dragHandleProps} className="cursor-grab"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
                                    {item.type === 'separator' ? (
                                      <div className="flex-1 h-px bg-border" />
                                    ) : item.type === 'system' ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        {getSystemIcon(item.system_type)}
                                        <span className="text-sm font-medium">{item.title}</span>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-auto"><MoveVertical className="h-3 w-3" /></Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => moveSystemItem(true, index, null, null)}>Auf Hauptebene verschieben</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {templateItems.map((targetItem, targetIdx) => {
                                              if (targetIdx === index || targetItem.type === 'separator' || targetItem.type === 'system') return null;
                                              return (
                                                <DropdownMenuItem key={targetIdx} onClick={() => moveSystemItem(true, index, null, targetIdx)}>
                                                  → {targetItem.title}
                                                </DropdownMenuItem>
                                              );
                                            })}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    ) : (
                                      <>
                                        {editingTemplate?.id === index.toString() && editingTemplate.field === 'title' ? (
                                          <div className="flex items-center gap-2 flex-1">
                                            <Input value={editingTemplate.value} onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })} className="flex-1" autoFocus />
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { updateTemplateItem(index, 'title', editingTemplate.value); setEditingTemplate(null); }}><Check className="h-3 w-3" /></Button>
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingTemplate(null)}><X className="h-3 w-3" /></Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 flex-1">
                                            <span>{item.title}</span>
                                            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-60 hover:opacity-100" onClick={() => setEditingTemplate({ id: index.toString(), field: 'title', value: item.title })}><Edit className="h-3 w-3" /></Button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    {item.type !== 'separator' && item.type !== 'system' && (
                                      <Popover open={childPopoverOpen === index} onOpenChange={(open) => setChildPopoverOpen(open ? index : null)}>
                                        <PopoverTrigger asChild>
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Plus className="h-3 w-3" /></Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72">
                                          <div className="space-y-3">
                                            <div>
                                              <p className="text-sm font-medium mb-2">Unterpunkt hinzufügen</p>
                                              <div className="flex gap-2">
                                                <Input placeholder="Neuer Unterpunkt..." className="flex-1 text-sm h-8" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value) { addTemplateItem((e.target as HTMLInputElement).value, index); (e.target as HTMLInputElement).value = ''; setChildPopoverOpen(null); } }} />
                                                <Button size="sm" className="h-8" onClick={(e) => { const input = (e.target as HTMLElement).closest('.flex')?.querySelector('input') as HTMLInputElement; if (input?.value) { addTemplateItem(input.value, index); input.value = ''; setChildPopoverOpen(null); } }}><Plus className="h-3 w-3" /></Button>
                                              </div>
                                            </div>
                                            {(() => {
                                              const availableChildren = item.children?.filter((c) => c.is_available === true) || [];
                                              if (availableChildren.length === 0) return null;
                                              return (
                                                <div className="border-t pt-2">
                                                  <p className="text-xs text-muted-foreground mb-2">Verfügbare Unterpunkte:</p>
                                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {item.children?.map((child, childIdx: number) => {
                                                      if (!child.is_available) return null;
                                                      return (
                                                        <Button key={childIdx} variant="ghost" size="sm" className="w-full justify-between text-sm h-8 px-2" onClick={() => activateChild(index, childIdx)}>
                                                          <span className="flex items-center gap-1.5 truncate">
                                                            {child.system_type && getSmallIcon(child.system_type)}
                                                            {child.title}
                                                          </span>
                                                          <CornerUpLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                                                        </Button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                            <div className="border-t pt-2">
                                              <p className="text-xs text-muted-foreground mb-2">Dynamische Inhalte:</p>
                                              <div className="flex flex-wrap gap-1">
                                                {(['upcoming_appointments', 'quick_notes', 'tasks', 'birthdays', 'decisions'] as const).map(type => {
                                                  const colors: Record<string, string> = {
                                                    upcoming_appointments: 'border-blue-200 text-blue-700',
                                                    quick_notes: 'border-amber-200 text-amber-700',
                                                    tasks: 'border-green-200 text-green-700',
                                                    birthdays: 'border-pink-200 text-pink-700',
                                                    decisions: 'border-violet-200 text-violet-700',
                                                  };
                                                  const labels: Record<string, string> = {
                                                    upcoming_appointments: 'Termine', quick_notes: 'Notizen', tasks: 'Aufgaben', birthdays: 'Geburtstage', decisions: 'Entscheidungen',
                                                  };
                                                  return (
                                                    <Button key={type} variant="outline" size="sm" className={`flex-1 justify-start ${colors[type]} h-7 text-xs`} onClick={() => { addSystemTemplateItem(type, index); setChildPopoverOpen(null); }}>
                                                      {getSmallIcon(type)}<span className="ml-1">{labels[type]}</span>
                                                    </Button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteTemplateItem(index)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>

                                  {/* Children */}
                                  {item.children && item.children.filter((c) => c.is_available !== true).length > 0 && (
                                    <div className="ml-8 mt-1 space-y-1">
                                      {item.children.map((child, childIndex: number) => {
                                        if (child.is_available === true) return null;
                                        const activeChildren = item.children.filter((c) => c.is_available !== true);
                                        const activeDisplayIndex = activeChildren.findIndex((c) => c === child);
                                        return (
                                          <div key={childIndex} className={`flex items-center gap-2 p-2 rounded-md border ${child.system_type ? getChildSystemClass(child.system_type) : 'bg-muted/30 border-border'}`}>
                                            <div className="flex flex-col gap-0.5">
                                              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" disabled={activeDisplayIndex === 0} onClick={() => moveChildItem(index, childIndex, 'up')}><ArrowUp className="h-2.5 w-2.5" /></Button>
                                              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" disabled={activeDisplayIndex === activeChildren.length - 1} onClick={() => moveChildItem(index, childIndex, 'down')}><ArrowDown className="h-2.5 w-2.5" /></Button>
                                            </div>
                                            {child.system_type ? (
                                              <div className="flex items-center gap-2 flex-1">
                                                {getSmallIcon(child.system_type, "h-3.5 w-3.5")}
                                                <span className="text-sm">{child.title}</span>
                                                {child.is_optional && <span className="text-xs text-muted-foreground">(optional)</span>}
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-auto"><MoveVertical className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                                  <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => moveSystemItem(false, index, childIndex, null)}>Auf Hauptebene verschieben</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {templateItems.map((targetItem, targetIdx) => {
                                                      if (targetIdx === index || targetItem.type === 'separator' || targetItem.type === 'system') return null;
                                                      return <DropdownMenuItem key={targetIdx} onClick={() => moveSystemItem(false, index, childIndex, targetIdx)}>→ {targetItem.title}</DropdownMenuItem>;
                                                    })}
                                                  </DropdownMenuContent>
                                                </DropdownMenu>
                                              </div>
                                            ) : editingChild?.parentIndex === index && editingChild?.childIndex === childIndex ? (
                                              <div className="flex items-center gap-1 flex-1">
                                                <Input value={editingChild.value} onChange={(e) => setEditingChild({ ...editingChild, value: e.target.value })} className="flex-1 h-7 text-sm" autoFocus />
                                                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => { updateChildItem(index, childIndex, editingChild.value); setEditingChild(null); }}><Check className="h-3 w-3" /></Button>
                                                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setEditingChild(null)}><X className="h-3 w-3" /></Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1 flex-1">
                                                <span className="text-sm">{child.title}</span>
                                                {child.is_optional && <span className="text-xs text-muted-foreground">(optional)</span>}
                                                <Button size="sm" variant="ghost" className="h-5 w-5 p-0 opacity-60 hover:opacity-100" onClick={() => setEditingChild({ parentIndex: index, childIndex, value: child.title })}><Edit className="h-3 w-3" /></Button>
                                              </div>
                                            )}
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-5 w-5 p-0"><Minus className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                              <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => toggleChildOptional(index, childIndex)}>{child.is_optional ? '✓ Pflicht machen' : '○ Optional machen'}</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => makeChildAvailable(index, childIndex)}>In Pool verschieben</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={() => setDeletingChild({ parentIndex: index, childIndex, title: child.title })}>Permanent löschen</DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        );
                                      })}
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

                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {newTemplateItem ? (
                      <>
                        <Input value={newTemplateItem.title} onChange={(e) => setNewTemplateItem({ ...newTemplateItem, title: e.target.value })} placeholder="Neuer Punkt..." className="flex-1" onKeyDown={(e) => { if (e.key === 'Enter' && newTemplateItem.title) addTemplateItem(newTemplateItem.title); }} />
                        <Button size="sm" onClick={() => addTemplateItem(newTemplateItem.title)}><Save className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setNewTemplateItem(null)}><X className="h-3 w-3" /></Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setNewTemplateItem({ title: '' })}><Plus className="h-4 w-4 mr-2" />Punkt hinzufügen</Button>
                        <Button variant="outline" onClick={addSeparator}><Minus className="h-4 w-4 mr-2" />Trenner hinzufügen</Button>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <p className="text-xs text-muted-foreground w-full mb-1">Dynamische Inhalte als Hauptpunkt:</p>
                    {selectedTemplate && (
                      <>
                        {(['upcoming_appointments', 'quick_notes', 'tasks', 'birthdays', 'decisions'] as const).map(type => {
                          const styles: Record<string, string> = {
                            upcoming_appointments: 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950',
                            quick_notes: 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950',
                            tasks: 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950',
                            birthdays: 'border-pink-200 text-pink-700 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-300 dark:hover:bg-pink-950',
                            decisions: 'border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950',
                          };
                          const labels: Record<string, string> = {
                            upcoming_appointments: 'Termine', quick_notes: 'Notizen', tasks: 'Aufgaben', birthdays: 'Geburtstage', decisions: 'Entscheidungen',
                          };
                          return (
                            <Button key={type} variant="outline" size="sm" className={styles[type]} onClick={() => addSystemTemplateItem(type)}>
                              {getSystemIcon(type)}<span className="ml-2">{labels[type]}</span>
                            </Button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Wählen Sie links ein Template aus</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

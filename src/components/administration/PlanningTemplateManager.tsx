import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Save, X, Check, GripVertical, Minus, Edit, Trash2 } from "lucide-react";

export function PlanningTemplateManager() {
  const { toast } = useToast();

  const [planningTemplates, setPlanningTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateItems, setTemplateItems] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; field: string; value: string } | null>(null);
  const [newTemplateItem, setNewTemplateItem] = useState<{ title: string; parentIndex?: number } | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase.from('planning_templates').select('*').order('name');
    if (!error) setPlanningTemplates(data || []);
  };

  const loadTemplate = (template: any) => {
    setSelectedTemplate(template);
    setTemplateItems(Array.isArray(template.template_items) ? template.template_items : []);
  };

  const saveTemplateItems = async (items = templateItems) => {
    if (!selectedTemplate) return;
    try {
      const { error } = await supabase.from('planning_templates').update({ template_items: items }).eq('id', selectedTemplate.id);
      if (error) throw error;
      if (items === templateItems) {
        toast({ title: "Gespeichert", description: "Template erfolgreich aktualisiert." });
      }
    } catch (error) {
      debugConsole.error(error);
      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(templateItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updatedItems = items.map((item, index) => ({ ...item, order_index: index }));
    setTemplateItems(updatedItems);
    saveTemplateItems(updatedItems);
  };

  const addTemplateItem = (title: string, parentIndex?: number) => {
    if (!selectedTemplate) return;
    const newItems = [...templateItems];
    if (parentIndex !== undefined) {
      if (!newItems[parentIndex].sub_items) newItems[parentIndex].sub_items = [];
      newItems[parentIndex].sub_items.push({ title, order_index: newItems[parentIndex].sub_items.length });
    } else {
      const itemType = title.startsWith('---') ? 'separator' : 'item';
      newItems.push({ title: itemType === 'separator' ? title.replace(/^---\s*/, '') : title, type: itemType, order_index: newItems.length });
    }
    setTemplateItems(newItems);
    saveTemplateItems(newItems);
    setNewTemplateItem(null);
  };

  const addSeparator = () => {
    if (!selectedTemplate) return;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Templates</CardTitle>
        <div className="flex gap-2">
          <Select onValueChange={(value) => {
            const template = planningTemplates.find(t => t.id === value);
            if (template) loadTemplate(template);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Template auswählen" />
            </SelectTrigger>
            <SelectContent>
              {planningTemplates.map(template => (
                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      {selectedTemplate && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            {editingTemplateName?.id === selectedTemplate.id ? (
              <>
                <Input value={editingTemplateName!.value} onChange={(e) => setEditingTemplateName({ id: editingTemplateName!.id, value: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={async () => {
                  try {
                    const { error } = await supabase.from('planning_templates').update({ name: editingTemplateName!.value }).eq('id', selectedTemplate.id);
                    if (error) throw error;
                    await loadTemplates();
                    setEditingTemplateName(null);
                    toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
                  } catch { toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" }); }
                }}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingTemplateName(null)}><X className="h-3 w-3" /></Button>
              </>
            ) : (
              <>
                <span className="font-medium flex-1">{selectedTemplate.name}</span>
                <Button size="sm" variant="outline" onClick={() => setEditingTemplateName({ id: selectedTemplate.id, value: selectedTemplate.name })}><Edit className="h-3 w-3" /></Button>
              </>
            )}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="planning-template-items">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {templateItems.map((item, index) => (
                    <Draggable key={index} draggableId={index.toString()} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} className="flex items-center gap-2 p-2 bg-card rounded border">
                          <div {...provided.dragHandleProps} className="cursor-grab"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
                          {item.type === 'separator' ? (
                            <div className="flex-1 h-px bg-border" />
                          ) : (
                            <>
                              {editingTemplate?.id === index.toString() && editingTemplate.field === 'title' ? (
                                <>
                                  <Input value={editingTemplate.value} onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })} className="flex-1" />
                                  <Button size="sm" onClick={() => { updateTemplateItem(index, 'title', editingTemplate.value); setEditingTemplate(null); }}><Check className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)}><X className="h-3 w-3" /></Button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1">{item.title}</span>
                                  <Button size="sm" variant="outline" onClick={() => setEditingTemplate({ id: index.toString(), field: 'title', value: item.title })}><Edit className="h-3 w-3" /></Button>
                                </>
                              )}
                            </>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => deleteTemplateItem(index)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="flex gap-2">
            {newTemplateItem ? (
              <>
                <Input value={newTemplateItem.title} onChange={(e) => setNewTemplateItem({ ...newTemplateItem, title: e.target.value })} placeholder="Neuer Punkt..." className="flex-1" />
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
        </CardContent>
      )}
    </Card>
  );
}

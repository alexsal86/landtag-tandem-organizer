import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvided } from "@hello-pangea/dnd";
import { Plus, X, Check, GripVertical, Minus, Edit, Trash2, Layers } from "lucide-react";

type TemplateItemType = "item" | "separator" | "system_social_media" | "system_rsvp" | "phase_start";

type TemplateItem = {
  title: string;
  order_index: number;
  type?: TemplateItemType;
  sub_items?: Array<{ title: string; order_index: number }>;
  relative_due_days?: number | null;
};

type NewTemplateItemDraft = {
  title: string;
  type: TemplateItemType;
  relativeDueValue: string;
  relativeDueDirection: "before" | "after";
};

type PhaseGroup = {
  phaseItem: TemplateItem | null;
  phaseIndex: number | null;
  phaseName: string | null;
  items: { item: TemplateItem; index: number }[];
};

type PlanningTemplate = {
  id: string;
  name: string;
  template_items: TemplateItem[] | null;
};

const SYSTEM_POINT_OPTIONS: Array<{ value: TemplateItemType; label: string }> = [
  { value: "item", label: "Normaler Punkt" },
  { value: "system_social_media", label: "Systempunkt: Social Media" },
  { value: "system_rsvp", label: "Systempunkt: Einladungen & RSVP" },
];

const createDraft = (): NewTemplateItemDraft => ({
  title: "",
  type: "item",
  relativeDueValue: "",
  relativeDueDirection: "before",
});

const toSignedRelativeDueDays = (value: string, direction: "before" | "after"): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  const absolute = Math.abs(parsed);
  return direction === "before" ? -absolute : absolute;
};

const getRelativeDueFormState = (relativeDueDays?: number | null) => {
  if (relativeDueDays == null) {
    return { relativeDueValue: "", relativeDueDirection: "before" as const };
  }

  return {
    relativeDueValue: String(Math.abs(relativeDueDays)),
    relativeDueDirection: relativeDueDays < 0 ? ("before" as const) : ("after" as const),
  };
};

const getRelativeDueSummary = (relativeDueDays?: number | null) => {
  if (relativeDueDays == null) return "Keine Frist";
  if (relativeDueDays === 0) return "am Veranstaltungstag";
  const days = Math.abs(relativeDueDays);
  return relativeDueDays < 0
    ? `${days} Tag${days === 1 ? "" : "e"} davor`
    : `${days} Tag${days === 1 ? "" : "e"} danach`;
};

function groupTemplateItemsByPhase(items: TemplateItem[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  let currentGroup: PhaseGroup = { phaseItem: null, phaseIndex: null, phaseName: null, items: [] };

  items.forEach((item, index) => {
    if (item.type === "phase_start") {
      if (currentGroup.items.length > 0 || currentGroup.phaseName !== null) {
        groups.push(currentGroup);
      }
      currentGroup = { phaseItem: item, phaseIndex: index, phaseName: item.title, items: [] };
    } else {
      currentGroup.items.push({ item, index });
    }
  });

  if (currentGroup.items.length > 0 || currentGroup.phaseName !== null) {
    groups.push(currentGroup);
  }

  return groups;
}

export function PlanningTemplateManager() {
  const { toast } = useToast();

  const [planningTemplates, setPlanningTemplates] = useState<PlanningTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PlanningTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; field: "title"; value: string } | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState<{ id: string; value: string } | null>(null);
  const [newTemplateItem, setNewTemplateItem] = useState<NewTemplateItemDraft | null>(null);
  const [editingDeadlineIndex, setEditingDeadlineIndex] = useState<number | null>(null);
  const [deadlineDraft, setDeadlineDraft] = useState<{ relativeDueValue: string; relativeDueDirection: "before" | "after" }>(getRelativeDueFormState());

  useEffect(() => {
    void loadTemplates();
  }, []);

  const selectedTemplateName = useMemo(() => selectedTemplate?.name ?? "", [selectedTemplate]);
  const phaseGroups = useMemo(() => groupTemplateItemsByPhase(templateItems), [templateItems]);
  const hasPhases = phaseGroups.some((g) => g.phaseName !== null);

  const loadTemplates = async () => {
    const { data, error } = await supabase.from("planning_templates").select("*").order("name");
    if (error) {
      debugConsole.error(error);
      return;
    }
    setPlanningTemplates(data || []);
  };

  const loadTemplate = (template: PlanningTemplate) => {
    setSelectedTemplate(template);
    const items = Array.isArray(template.template_items) ? template.template_items : [];
    setTemplateItems(items);
    setEditingDeadlineIndex(null);
    setNewTemplateItem(null);
  };

  const saveTemplateItems = async (items = templateItems) => {
    if (!selectedTemplate) return;
    try {
      const { error } = await supabase.from("planning_templates").update({ template_items: items }).eq("id", selectedTemplate.id);
      if (error) throw error;

      setPlanningTemplates((prev) => prev.map((template) => template.id === selectedTemplate.id ? { ...template, template_items: items } : template));
      setSelectedTemplate((prev) => (prev ? { ...prev, template_items: items } : prev));

      if (items === templateItems) {
        toast({ title: "Gespeichert", description: "Template erfolgreich aktualisiert." });
      }
    } catch (error) {
      debugConsole.error(error);
      toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(templateItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    const updatedItems = items.map((item, index) => ({ ...item, order_index: index }));
    setTemplateItems(updatedItems);
    void saveTemplateItems(updatedItems);
  };

  const addTemplateItem = () => {
    if (!selectedTemplate || !newTemplateItem) return;
    const title = newTemplateItem.title.trim();
    if (!title) return;

    const newItems = [...templateItems];
    newItems.push({
      title,
      type: newTemplateItem.type,
      order_index: newItems.length,
      relative_due_days: toSignedRelativeDueDays(newTemplateItem.relativeDueValue, newTemplateItem.relativeDueDirection),
    });
    setTemplateItems(newItems);
    void saveTemplateItems(newItems);
    setNewTemplateItem(null);
  };

  const addSeparator = () => {
    if (!selectedTemplate) return;
    const newItems = [...templateItems];
    newItems.push({ title: "", type: "separator", order_index: newItems.length });
    setTemplateItems(newItems);
    void saveTemplateItems(newItems);
  };

  const addPhaseStart = () => {
    if (!selectedTemplate) return;
    const newItems = [...templateItems];
    newItems.push({ title: "Neue Phase", type: "phase_start", order_index: newItems.length });
    setTemplateItems(newItems);
    void saveTemplateItems(newItems);
  };

  const updateTemplateItem = (index: number, patch: Partial<TemplateItem>) => {
    const newItems = [...templateItems];
    newItems[index] = { ...newItems[index], ...patch };
    setTemplateItems(newItems);
    void saveTemplateItems(newItems);
  };

  const deleteTemplateItem = (index: number) => {
    const newItems = templateItems.filter((_, i) => i !== index).map((item, orderIndex) => ({ ...item, order_index: orderIndex }));
    setTemplateItems(newItems);
    void saveTemplateItems(newItems);
  };

  const renderTemplateItem = (item: TemplateItem, index: number, dragProvided: DraggableProvided) => {
    if (item.type === "separator") {
      return (
        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="group rounded border bg-card p-2">
          <div className="flex items-center gap-2">
            <div {...dragProvided.dragHandleProps} className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="text-xs text-muted-foreground">Trenner</span>
            <Button size="sm" variant="destructive" onClick={() => deleteTemplateItem(index)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      );
    }

    if (item.type === "phase_start") {
      // Phase items rendered as headers — keep hidden draggable for DnD
      return (
        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} className="hidden" />
      );
    }

    return (
      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="group space-y-2 rounded border bg-card p-2">
        <div className="flex items-center gap-2">
          <div {...dragProvided.dragHandleProps} className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
          {editingTemplate?.id === index.toString() ? (
            <>
              <Input value={editingTemplate.value} onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })} className="flex-1" />
              <Button size="sm" onClick={() => { updateTemplateItem(index, { title: editingTemplate.value }); setEditingTemplate(null); }}><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)}><X className="h-3 w-3" /></Button>
            </>
          ) : (
            <>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{item.title}</span>
                  {item.type && item.type !== "item" && (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      {item.type === "system_social_media" ? "Systempunkt: Social Media" : "Systempunkt: RSVP"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Frist: {getRelativeDueSummary(item.relative_due_days)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditingTemplate({ id: index.toString(), field: "title", value: item.title })}><Edit className="h-3 w-3" /></Button>
            </>
          )}
          <Button size="sm" variant="destructive" onClick={() => deleteTemplateItem(index)}><Trash2 className="h-3 w-3" /></Button>
        </div>

        <div className="rounded-md border border-dashed border-border/80 bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Frist relativ zum Endtermin</Label>
            {editingDeadlineIndex === index ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    updateTemplateItem(index, {
                      relative_due_days: toSignedRelativeDueDays(deadlineDraft.relativeDueValue, deadlineDraft.relativeDueDirection),
                    });
                    setEditingDeadlineIndex(null);
                  }}
                ><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingDeadlineIndex(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDeadlineIndex(index);
                  setDeadlineDraft(getRelativeDueFormState(item.relative_due_days));
                }}
              >
                <Edit className="mr-1 h-3 w-3" /> Frist bearbeiten
              </Button>
            )}
          </div>

          {editingDeadlineIndex === index ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                min="0"
                value={deadlineDraft.relativeDueValue}
                onChange={(e) => setDeadlineDraft((prev) => ({ ...prev, relativeDueValue: e.target.value }))}
                placeholder="Anzahl Tage"
                className="sm:w-40"
              />
              <Select value={deadlineDraft.relativeDueDirection} onValueChange={(value: "before" | "after") => setDeadlineDraft((prev) => ({ ...prev, relativeDueDirection: value }))}>
                <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Tage vor Endtermin</SelectItem>
                  <SelectItem value="after">Tage nach Veranstaltung</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={() => {
                setDeadlineDraft(getRelativeDueFormState());
                updateTemplateItem(index, { relative_due_days: null });
                setEditingDeadlineIndex(null);
              }}>Frist entfernen</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{getRelativeDueSummary(item.relative_due_days)}</p>
          )}
        </div>
      </div>
    );
  };

  const renderPhaseHeader = (group: PhaseGroup) => {
    if (!group.phaseItem || group.phaseIndex === null) return null;
    const phaseItem = group.phaseItem;
    const phaseIndex = group.phaseIndex;
    const itemCount = group.items.filter(i => i.item.type !== "separator").length;

    return (
      <div className="group mt-4 first:mt-0">
        <div className="flex items-center gap-3 py-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            {editingTemplate?.id === phaseIndex.toString() ? (
              <>
                <Input value={editingTemplate.value} onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={() => { updateTemplateItem(phaseIndex, { title: editingTemplate.value }); setEditingTemplate(null); }}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)}><X className="h-3 w-3" /></Button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-primary">{phaseItem.title}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{itemCount}</Badge>
                <Button size="sm" variant="outline" onClick={() => setEditingTemplate({ id: phaseIndex.toString(), field: "title", value: phaseItem.title })} className="opacity-0 group-hover:opacity-100 transition-opacity"><Edit className="h-3 w-3" /></Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteTemplateItem(phaseIndex)}
              title="Phase löschen"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="h-0.5 bg-primary/30 rounded-full" />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning Templates</CardTitle>
        <div className="flex gap-2">
          <Select onValueChange={(value) => {
            const template = planningTemplates.find((t) => t.id === value);
            if (template) loadTemplate(template);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Template auswählen" />
            </SelectTrigger>
            <SelectContent>
              {planningTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      {selectedTemplate && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            {editingTemplateName?.id === selectedTemplate.id ? (
              <>
                <Input value={editingTemplateName.value} onChange={(e) => setEditingTemplateName({ id: editingTemplateName.id, value: e.target.value })} className="flex-1" />
                <Button size="sm" onClick={async () => {
                  try {
                    const { error } = await supabase.from("planning_templates").update({ name: editingTemplateName.value }).eq("id", selectedTemplate.id);
                    if (error) throw error;
                    await loadTemplates();
                    setSelectedTemplate({ ...selectedTemplate, name: editingTemplateName.value });
                    setEditingTemplateName(null);
                    toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
                  } catch {
                    toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
                  }
                }}><Check className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingTemplateName(null)}><X className="h-3 w-3" /></Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium">{selectedTemplateName}</span>
                <Button size="sm" variant="outline" onClick={() => setEditingTemplateName({ id: selectedTemplate.id, value: selectedTemplate.name })}><Edit className="h-3 w-3" /></Button>
              </>
            )}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="planning-template-items">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {hasPhases ? (
                    phaseGroups.map((group, groupIndex) => (
                      <div key={groupIndex}>
                        {group.phaseName !== null && renderPhaseHeader(group)}
                        {group.phaseName !== null && group.items.length === 0 && (
                          <div className="py-2 text-xs text-muted-foreground italic pl-4">Keine Punkte in dieser Phase</div>
                        )}
                        {group.items.map(({ item, index }) => (
                          <Draggable key={`${item.title}-${index}`} draggableId={index.toString()} index={index}>
                            {(dragProvided) => renderTemplateItem(item, index, dragProvided)}
                          </Draggable>
                        ))}
                        {/* Hidden draggable for phase_start DnD */}
                        {group.phaseIndex !== null && (
                          <Draggable key={`phase-${group.phaseIndex}`} draggableId={group.phaseIndex.toString()} index={group.phaseIndex}>
                            {(dragProvided) => (
                              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} className="hidden" />
                            )}
                          </Draggable>
                        )}
                      </div>
                    ))
                  ) : (
                    templateItems.map((item, index) => (
                      <Draggable key={`${item.title}-${index}`} draggableId={index.toString()} index={index}>
                        {(dragProvided) => renderTemplateItem(item, index, dragProvided)}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="rounded-md border border-dashed border-border p-3">
            {newTemplateItem ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Punkttyp</Label>
                    <Select value={newTemplateItem.type} onValueChange={(value: TemplateItemType) => setNewTemplateItem((prev) => prev ? { ...prev, type: value } : prev)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SYSTEM_POINT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Titel</Label>
                    <Input value={newTemplateItem.title} onChange={(e) => setNewTemplateItem((prev) => prev ? { ...prev, title: e.target.value } : prev)} placeholder="Neuer Punkt..." className="flex-1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Frist in Tagen</Label>
                    <Input type="number" min="0" value={newTemplateItem.relativeDueValue} onChange={(e) => setNewTemplateItem((prev) => prev ? { ...prev, relativeDueValue: e.target.value } : prev)} placeholder="leer = keine Frist" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bezug</Label>
                    <Select value={newTemplateItem.relativeDueDirection} onValueChange={(value: "before" | "after") => setNewTemplateItem((prev) => prev ? { ...prev, relativeDueDirection: value } : prev)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">vor Endtermin</SelectItem>
                        <SelectItem value="after">nach Veranstaltung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addTemplateItem}><Check className="mr-2 h-3 w-3" />Übernehmen</Button>
                  <Button size="sm" variant="outline" onClick={() => setNewTemplateItem(null)}><X className="mr-2 h-3 w-3" />Abbrechen</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setNewTemplateItem(createDraft())}><Plus className="mr-2 h-4 w-4" />Punkt hinzufügen</Button>
                <Button variant="outline" onClick={addSeparator}><Minus className="mr-2 h-4 w-4" />Trenner hinzufügen</Button>
                <Button variant="outline" onClick={addPhaseStart} className="text-primary border-primary/30"><Layers className="mr-2 h-4 w-4" />Phase hinzufügen</Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

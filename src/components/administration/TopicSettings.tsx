import React, { useState } from "react";
import { useTopics, Topic } from "@/hooks/useTopics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, GripVertical, Edit, Trash2, Tag, FileText, Users, Calendar, CheckSquare, Briefcase } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { TagIconPicker } from "@/components/contacts/TagIconPicker";

const getIconComponent = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-4 w-4" /> : <Tag className="h-4 w-4" />;
};

export const TopicSettings = () => {
  const { topics, loading, createTopic, updateTopic, deleteTopic, toggleActive, updateOrder } = useTopics();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    icon: 'Tag',
    color: '#3b82f6',
    description: '',
  });

  const resetForm = () => {
    setFormData({ name: '', label: '', icon: 'Tag', color: '#3b82f6', description: '' });
  };

  const handleCreate = async () => {
    if (!formData.label.trim()) return;
    
    const name = formData.name || formData.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await createTopic({ ...formData, name });
    resetForm();
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingTopic || !formData.label.trim()) return;
    
    await updateTopic(editingTopic.id, formData);
    setEditingTopic(null);
    resetForm();
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(topics);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const orderedTopics = items.map((item, index) => ({
      id: item.id,
      order_index: index,
    }));

    updateOrder(orderedTopics);
  };

  const openEdit = (topic: Topic) => {
    setFormData({
      name: topic.name,
      label: topic.label,
      icon: topic.icon || 'Tag',
      color: topic.color || '#3b82f6',
      description: topic.description || '',
    });
    setEditingTopic(topic);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Zentrale Themen
            </CardTitle>
            <CardDescription>
              Themen können allen Modulen zugewiesen werden: FallAkten, Kontakte, Aufgaben, Termine, Dokumente
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Neues Thema
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neues Thema erstellen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Bezeichnung</Label>
                  <Input
                    value={formData.label}
                    onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="z.B. Bildungspolitik"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                  <Label>Icon</Label>
                  <TagIconPicker
                    value={formData.icon}
                    onChange={(icon) => setFormData(prev => ({ ...prev, icon }))}
                  />
                  </div>
                  <div className="space-y-2">
                    <Label>Farbe</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung (optional)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Kurze Beschreibung des Themas..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Abbrechen</Button>
                <Button onClick={handleCreate}>Erstellen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Module usage legend */}
        <div className="flex flex-wrap gap-4 mb-6 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" /> FallAkten
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Kontakte
          </span>
          <span className="flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Aufgaben
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Termine
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Dokumente
          </span>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="topics">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {topics.map((topic, index) => (
                  <Draggable key={topic.id} draggableId={topic.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          snapshot.isDragging ? 'bg-accent shadow-lg' : 'bg-card'
                        } ${!topic.is_active ? 'opacity-50' : ''}`}
                      >
                        <div {...provided.dragHandleProps} className="cursor-grab">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div
                          className="flex items-center justify-center w-8 h-8 rounded"
                          style={{ backgroundColor: topic.color + '20', color: topic.color }}
                        >
                          {getIconComponent(topic.icon || 'Tag')}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{topic.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {topic.name}
                            </Badge>
                          </div>
                          {topic.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {topic.description}
                            </p>
                          )}
                        </div>

                        <Switch
                          checked={topic.is_active}
                          onCheckedChange={(checked) => toggleActive(topic.id, checked)}
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(topic)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Thema löschen?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Das Thema "{topic.label}" wird aus allen verknüpften Elementen entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTopic(topic.id)}>
                                Löschen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {topics.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Keine Themen vorhanden. Erstellen Sie das erste Thema.
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingTopic} onOpenChange={(open) => !open && setEditingTopic(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thema bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bezeichnung</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <TagIconPicker
                  value={formData.icon}
                  onChange={(icon) => setFormData(prev => ({ ...prev, icon }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Farbe</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTopic(null)}>Abbrechen</Button>
            <Button onClick={handleUpdate}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

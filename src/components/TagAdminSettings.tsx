import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Edit, Plus, Save, X, GripVertical } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

type Tag = {
  id: string;
  name: string;
  label: string;
  color: string;
  is_active: boolean;
  order_index: number;
};

export function TagAdminSettings() {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<{ id: string; label: string; color: string } | null>(null);
  const [newTag, setNewTag] = useState<{ label: string; color: string } | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast({ title: "Fehler", description: "Tags konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addTag = async (label: string, color: string) => {
    if (!label.trim()) return;
    
    try {
      const { error } = await supabase.from('tags').insert({
        name: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        color,
        order_index: Math.max(...tags.map(t => t.order_index), -1) + 1
      });
      
      if (error) throw error;
      
      await loadTags();
      setNewTag(null);
      toast({ title: "Erfolg", description: "Tag wurde erfolgreich hinzugefügt." });
    } catch (error: any) {
      console.error('Error adding tag:', error);
      toast({ title: "Fehler", description: "Tag konnte nicht hinzugefügt werden.", variant: "destructive" });
    }
  };

  const saveTag = async (id: string, label: string, color: string) => {
    if (!label.trim()) return;
    
    try {
      const { error } = await supabase.from('tags').update({
        name: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        color
      }).eq('id', id);
      
      if (error) throw error;
      
      await loadTags();
      setEditingTag(null);
      toast({ title: "Erfolg", description: "Tag wurde erfolgreich aktualisiert." });
    } catch (error: any) {
      console.error('Error updating tag:', error);
      toast({ title: "Fehler", description: "Tag konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
      
      await loadTags();
      toast({ title: "Erfolg", description: "Tag wurde erfolgreich gelöscht." });
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      toast({ title: "Fehler", description: "Tag konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('tags').update({ is_active: !isActive }).eq('id', id);
      if (error) throw error;
      
      await loadTags();
      toast({ title: "Erfolg", description: `Tag wurde ${!isActive ? 'aktiviert' : 'deaktiviert'}.` });
    } catch (error: any) {
      console.error('Error toggling tag:', error);
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(tags);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order_index for all items
    const updatedItems = items.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setTags(updatedItems);

    // Save new order to database
    try {
      for (const item of updatedItems) {
        await supabase.from('tags').update({ order_index: item.order_index }).eq('id', item.id);
      }
      toast({ title: "Erfolg", description: "Reihenfolge wurde gespeichert." });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
      loadTags(); // Reload on error
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tags & Kategorien</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Tags & Kategorien
          <Button
            onClick={() => setNewTag({ label: '', color: '#3b82f6' })}
            size="sm"
            className="ml-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Neuer Tag
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tags">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="w-24">Farbe</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead className="w-32">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newTag && (
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>
                          <Input
                            value={newTag.label}
                            onChange={(e) => setNewTag({ ...newTag, label: e.target.value })}
                            placeholder="Tag-Name eingeben..."
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newTag.color}
                              onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                              className="w-8 h-8 border border-border rounded cursor-pointer"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">Aktiv</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              onClick={() => addTag(newTag.label, newTag.color)}
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setNewTag(null)}
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {tags.map((tag, index) => (
                      <Draggable key={tag.id} draggableId={tag.id} index={index}>
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={!tag.is_active ? "opacity-50" : ""}
                          >
                            <TableCell {...provided.dragHandleProps} className="cursor-move">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                            <TableCell>
                              {editingTag?.id === tag.id ? (
                                <Input
                                  value={editingTag.label}
                                  onChange={(e) => setEditingTag({ ...editingTag, label: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  {tag.label}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingTag?.id === tag.id ? (
                                <input
                                  type="color"
                                  value={editingTag.color}
                                  onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                                  className="w-8 h-8 border border-border rounded cursor-pointer"
                                />
                              ) : (
                                <span
                                  className="inline-block w-8 h-8 rounded border border-border cursor-pointer"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                onClick={() => toggleActive(tag.id, tag.is_active)}
                                size="sm"
                                variant={tag.is_active ? "default" : "secondary"}
                                className="h-6 px-2 text-xs"
                              >
                                {tag.is_active ? 'Aktiv' : 'Inaktiv'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {editingTag?.id === tag.id ? (
                                  <>
                                    <Button
                                      onClick={() => saveTag(tag.id, editingTag.label, editingTag.color)}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      onClick={() => setEditingTag(null)}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      onClick={() => setEditingTag({ id: tag.id, label: tag.label, color: tag.color })}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 w-8 p-0"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Tag löschen</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Sind Sie sicher, dass Sie den Tag "{tag.label}" löschen möchten? 
                                            Diese Aktion kann nicht rückgängig gemacht werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteTag(tag.id)}>
                                            Löschen
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </TableBody>
                </Table>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </CardContent>
    </Card>
  );
}
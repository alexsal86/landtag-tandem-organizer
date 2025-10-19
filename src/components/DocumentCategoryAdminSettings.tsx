import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Edit, Plus, Save, X, GripVertical } from "lucide-react";
import { icons, LucideIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { TagIconPicker } from "@/components/contacts/TagIconPicker";

type DocumentCategory = {
  id: string;
  name: string;
  label: string;
  color: string;
  icon?: string;
  is_active: boolean;
  order_index: number;
};

export function DocumentCategoryAdminSettings() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<{ id: string; label: string; color: string; icon?: string } | null>(null);
  const [newCategory, setNewCategory] = useState<{ label: string; color: string; icon?: string } | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading document categories:', error);
      toast({ title: "Fehler", description: "Dokumenten-Kategorien konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (label: string, color: string, icon?: string) => {
    if (!label.trim()) return;
    
    try {
      const { error } = await supabase.from('document_categories').insert({
        name: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        color,
        icon: icon || null,
        order_index: Math.max(...categories.map(c => c.order_index), -1) + 1
      });
      
      if (error) throw error;
      
      await loadCategories();
      setNewCategory(null);
      toast({ title: "Erfolg", description: "Kategorie wurde erfolgreich hinzugefügt." });
    } catch (error: any) {
      console.error('Error adding category:', error);
      toast({ title: "Fehler", description: "Kategorie konnte nicht hinzugefügt werden.", variant: "destructive" });
    }
  };

  const saveCategory = async (id: string, label: string, color: string, icon?: string) => {
    if (!label.trim()) return;
    
    try {
      const { error } = await supabase.from('document_categories').update({
        name: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        color,
        icon: icon || null
      }).eq('id', id);
      
      if (error) throw error;
      
      await loadCategories();
      setEditingCategory(null);
      toast({ title: "Erfolg", description: "Kategorie wurde erfolgreich aktualisiert." });
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast({ title: "Fehler", description: "Kategorie konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const getIconComponent = (iconName?: string): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from('document_categories').delete().eq('id', id);
      if (error) throw error;
      
      await loadCategories();
      toast({ title: "Erfolg", description: "Kategorie wurde erfolgreich gelöscht." });
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast({ title: "Fehler", description: "Kategorie konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('document_categories').update({ is_active: !isActive }).eq('id', id);
      if (error) throw error;
      
      await loadCategories();
      toast({ title: "Erfolg", description: `Kategorie wurde ${!isActive ? 'aktiviert' : 'deaktiviert'}.` });
    } catch (error: any) {
      console.error('Error toggling category:', error);
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setCategories(updatedItems);

    try {
      for (const item of updatedItems) {
        await supabase.from('document_categories').update({ order_index: item.order_index }).eq('id', item.id);
      }
      toast({ title: "Erfolg", description: "Reihenfolge wurde gespeichert." });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
      loadCategories();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dokumenten-Kategorien</CardTitle>
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
          Dokumenten-Kategorien
          <Button
            onClick={() => setNewCategory({ label: '', color: '#3b82f6', icon: undefined })}
            size="sm"
            className="ml-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Neue Kategorie
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="document-categories">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="w-16">Icon</TableHead>
                      <TableHead className="w-24">Farbe</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead className="w-32">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newCategory && (
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>
                          <Input
                            value={newCategory.label}
                            onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                            placeholder="Kategorie-Name eingeben..."
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <TagIconPicker
                            value={newCategory.icon}
                            onChange={(icon) => setNewCategory({ ...newCategory, icon })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newCategory.color}
                              onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
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
                              onClick={() => addCategory(newCategory.label, newCategory.color, newCategory.icon)}
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setNewCategory(null)}
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

                    {categories.map((category, index) => (
                      <Draggable key={category.id} draggableId={category.id} index={index}>
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={!category.is_active ? "opacity-50" : ""}
                          >
                            <TableCell {...provided.dragHandleProps} className="cursor-move">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                            <TableCell>
                              {editingCategory?.id === category.id ? (
                                <Input
                                  value={editingCategory.label}
                                  onChange={(e) => setEditingCategory({ ...editingCategory, label: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  {(() => {
                                    const Icon = getIconComponent(category.icon);
                                    return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                                  })()}
                                  {category.label}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingCategory?.id === category.id ? (
                                <TagIconPicker
                                  value={editingCategory.icon}
                                  onChange={(icon) => setEditingCategory({ ...editingCategory, icon })}
                                />
                              ) : (
                                (() => {
                                  const Icon = getIconComponent(category.icon);
                                  return Icon ? (
                                    <div className="flex items-center justify-center w-8 h-8">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center w-8 h-8 text-muted-foreground">
                                      -
                                    </div>
                                  );
                                })()
                              )}
                            </TableCell>
                            <TableCell>
                              {editingCategory?.id === category.id ? (
                                <input
                                  type="color"
                                  value={editingCategory.color}
                                  onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                                  className="w-8 h-8 border border-border rounded cursor-pointer"
                                />
                              ) : (
                                <span
                                  className="inline-block w-8 h-8 rounded border border-border cursor-pointer"
                                  style={{ backgroundColor: category.color }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                onClick={() => toggleActive(category.id, category.is_active)}
                                size="sm"
                                variant={category.is_active ? "default" : "secondary"}
                                className="h-6 px-2 text-xs"
                              >
                                {category.is_active ? 'Aktiv' : 'Inaktiv'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {editingCategory?.id === category.id ? (
                                  <>
                                    <Button
                                      onClick={() => saveCategory(category.id, editingCategory.label, editingCategory.color, editingCategory.icon)}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      onClick={() => setEditingCategory(null)}
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
                                      onClick={() => setEditingCategory({ id: category.id, label: category.label, color: category.color, icon: category.icon })}
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
                                          <AlertDialogTitle>Kategorie löschen</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Sind Sie sicher, dass Sie die Kategorie "{category.label}" löschen möchten? 
                                            Diese Aktion kann nicht rückgängig gemacht werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteCategory(category.id)}>
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

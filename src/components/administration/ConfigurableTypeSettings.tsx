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

type ConfigurableType = {
  id: string;
  name: string;
  label: string;
  color?: string | null;
  icon?: string | null;
  is_active: boolean;
  order_index: number;
};

interface ConfigurableTypeSettingsProps {
  title: string;
  tableName: 'task_categories' | 'todo_categories' | 'case_file_types' | 'document_categories' | 'appointment_categories' | 'appointment_statuses' | 'appointment_locations' | 'task_statuses';
  entityName: string;
  deleteWarning?: string;
  hasIcon?: boolean;
  hasColor?: boolean;
  defaultIcon?: string;
  defaultColor?: string;
}

export function ConfigurableTypeSettings({
  title,
  tableName,
  entityName,
  deleteWarning,
  hasIcon = true,
  hasColor = true,
  defaultIcon = 'Folder',
  defaultColor = '#3b82f6'
}: ConfigurableTypeSettingsProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ConfigurableType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<{ id: string; label: string; color: string; icon?: string } | null>(null);
  const [newItem, setNewItem] = useState<{ label: string; color: string; icon?: string } | null>(null);

  useEffect(() => {
    loadItems();
  }, [tableName]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('order_index');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(`Error loading ${tableName}:`, error);
      toast({ title: "Fehler", description: `${title} konnten nicht geladen werden.`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, movedItem);

    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setItems(updatedItems);

    try {
      for (const item of updatedItems) {
        await supabase.from(tableName).update({ order_index: item.order_index }).eq('id', item.id);
      }
      toast({ title: "Erfolg", description: "Reihenfolge wurde gespeichert." });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
      loadItems();
    }
  };

  const handleCreate = async () => {
    if (!newItem?.label.trim()) return;

    try {
      const insertData: any = {
        name: newItem.label.toLowerCase().replace(/\s+/g, '_'),
        label: newItem.label,
        order_index: Math.max(...items.map(i => i.order_index), -1) + 1
      };

      if (hasColor) {
        insertData.color = newItem.color || defaultColor;
      }
      if (hasIcon) {
        insertData.icon = newItem.icon || defaultIcon;
      }

      const { error } = await supabase.from(tableName).insert(insertData);
      if (error) throw error;

      await loadItems();
      setNewItem(null);
      toast({ title: "Erfolg", description: `${entityName} wurde erfolgreich hinzugefügt.` });
    } catch (error: any) {
      console.error(`Error adding ${entityName}:`, error);
      toast({ title: "Fehler", description: `${entityName} konnte nicht hinzugefügt werden.`, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!editingItem?.label.trim()) return;

    // Optimistic UI: Update state immediately
    const previousItems = [...items];
    const updatedItems = items.map(item => 
      item.id === editingItem.id 
        ? { ...item, label: editingItem.label, color: editingItem.color, icon: editingItem.icon }
        : item
    );
    setItems(updatedItems);
    setEditingItem(null);

    try {
      const updateData: any = {
        name: editingItem.label.toLowerCase().replace(/\s+/g, '_'),
        label: editingItem.label
      };

      if (hasColor) {
        updateData.color = editingItem.color;
      }
      if (hasIcon) {
        updateData.icon = editingItem.icon || null;
      }

      const { error } = await supabase.from(tableName).update(updateData).eq('id', editingItem.id);
      
      if (error) {
        // Rollback on error
        setItems(previousItems);
        throw error;
      }

      toast({ title: "Erfolg", description: `${entityName} wurde erfolgreich aktualisiert.` });
    } catch (error: any) {
      console.error(`Error updating ${entityName}:`, error);
      toast({ title: "Fehler", description: `${entityName} konnte nicht aktualisiert werden.`, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;

      await loadItems();
      toast({ title: "Erfolg", description: `${entityName} wurde erfolgreich gelöscht.` });
    } catch (error: any) {
      console.error(`Error deleting ${entityName}:`, error);
      toast({ title: "Fehler", description: `${entityName} konnte nicht gelöscht werden.`, variant: "destructive" });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    // Optimistic UI: Update state immediately
    const previousItems = [...items];
    const updatedItems = items.map(item => 
      item.id === id ? { ...item, is_active: !isActive } : item
    );
    setItems(updatedItems);

    try {
      const { error } = await supabase.from(tableName).update({ is_active: !isActive }).eq('id', id);
      
      if (error) {
        // Rollback on error
        setItems(previousItems);
        throw error;
      }

      toast({ title: "Erfolg", description: `${entityName} wurde ${!isActive ? 'aktiviert' : 'deaktiviert'}.` });
    } catch (error: any) {
      console.error(`Error toggling ${entityName}:`, error);
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
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
          {title}
          <Button
            onClick={() => setNewItem({ label: '', color: defaultColor, icon: defaultIcon })}
            size="sm"
            className="ml-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            {entityName} hinzufügen
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`${tableName}-list`}>
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Label</TableHead>
                      {hasIcon && <TableHead className="w-16">Icon</TableHead>}
                      {hasColor && <TableHead className="w-24">Farbe</TableHead>}
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead className="w-32">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newItem && (
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>
                          <Input
                            value={newItem.label}
                            onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                            placeholder={`${entityName}-Name eingeben...`}
                            className="h-8"
                          />
                        </TableCell>
                        {hasIcon && (
                          <TableCell>
                            <TagIconPicker
                              value={newItem.icon}
                              onChange={(icon) => setNewItem({ ...newItem, icon })}
                            />
                          </TableCell>
                        )}
                        {hasColor && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={newItem.color}
                                onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                                className="w-8 h-8 border border-border rounded cursor-pointer"
                              />
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <span className="text-sm text-muted-foreground">Aktiv</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              onClick={handleCreate}
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setNewItem(null)}
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

                    {items.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={!item.is_active ? "opacity-50" : ""}
                          >
                            <TableCell {...provided.dragHandleProps} className="cursor-move">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                            <TableCell>
                              {editingItem?.id === item.id ? (
                                <Input
                                  value={editingItem.label}
                                  onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  {hasColor && (
                                    <span
                                      className="inline-block w-3 h-3 rounded-full"
                                      style={{ backgroundColor: item.color || defaultColor }}
                                    />
                                  )}
                                  {hasIcon && (() => {
                                    const Icon = getIconComponent(item.icon);
                                    return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                                  })()}
                                  {item.label}
                                </div>
                              )}
                            </TableCell>
                            {hasIcon && (
                              <TableCell>
                                {editingItem?.id === item.id ? (
                                  <TagIconPicker
                                    value={editingItem.icon}
                                    onChange={(icon) => setEditingItem({ ...editingItem, icon })}
                                  />
                                ) : (
                                  (() => {
                                    const Icon = getIconComponent(item.icon);
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
                            )}
                            {hasColor && (
                              <TableCell>
                                {editingItem?.id === item.id ? (
                                  <input
                                    type="color"
                                    value={editingItem.color}
                                    onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                                    className="w-8 h-8 border border-border rounded cursor-pointer"
                                  />
                                ) : (
                                  <span
                                    className="inline-block w-8 h-8 rounded border border-border cursor-pointer"
                                    style={{ backgroundColor: item.color || defaultColor }}
                                  />
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <Button
                                onClick={() => toggleActive(item.id, item.is_active)}
                                size="sm"
                                variant={item.is_active ? "default" : "secondary"}
                                className="h-6 px-2 text-xs"
                              >
                                {item.is_active ? 'Aktiv' : 'Inaktiv'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {editingItem?.id === item.id ? (
                                  <>
                                    <Button
                                      onClick={handleSave}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      onClick={() => setEditingItem(null)}
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
                                      onClick={() => setEditingItem({ 
                                        id: item.id, 
                                        label: item.label, 
                                        color: item.color || defaultColor, 
                                        icon: item.icon || undefined 
                                      })}
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
                                          <AlertDialogTitle>{entityName} löschen</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {deleteWarning || `Sind Sie sicher, dass Sie "${item.label}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(item.id)}>
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
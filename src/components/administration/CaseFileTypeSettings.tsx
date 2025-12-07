import { useState } from "react";
import { useCaseFileTypes, CaseFileType } from "@/hooks/useCaseFileTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Edit, Plus, Save, X, GripVertical } from "lucide-react";
import { icons, LucideIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { TagIconPicker } from "@/components/contacts/TagIconPicker";

export function CaseFileTypeSettings() {
  const { caseFileTypes, loading, createCaseFileType, updateCaseFileType, deleteCaseFileType, toggleActive, updateOrder } = useCaseFileTypes();
  const [editingType, setEditingType] = useState<{ id: string; label: string; color: string; icon?: string } | null>(null);
  const [newType, setNewType] = useState<{ label: string; color: string; icon?: string } | null>(null);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(caseFileTypes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      order_index: index
    }));

    await updateOrder(updatedItems);
  };

  const handleCreate = async () => {
    if (!newType?.label.trim()) return;
    const success = await createCaseFileType({
      label: newType.label,
      icon: newType.icon,
      color: newType.color,
    });
    if (success) {
      setNewType(null);
    }
  };

  const handleSave = async () => {
    if (!editingType?.label.trim()) return;
    const success = await updateCaseFileType(editingType.id, {
      label: editingType.label,
      icon: editingType.icon,
      color: editingType.color,
    });
    if (success) {
      setEditingType(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>FallAkten-Typen</CardTitle>
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
          FallAkten-Typen
          <Button
            onClick={() => setNewType({ label: '', color: '#3b82f6', icon: 'Folder' })}
            size="sm"
            className="ml-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Neuer Typ
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="case-file-types">
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
                    {newType && (
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>
                          <Input
                            value={newType.label}
                            onChange={(e) => setNewType({ ...newType, label: e.target.value })}
                            placeholder="Typ-Name eingeben..."
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <TagIconPicker
                            value={newType.icon}
                            onChange={(icon) => setNewType({ ...newType, icon })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={newType.color}
                              onChange={(e) => setNewType({ ...newType, color: e.target.value })}
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
                              onClick={handleCreate}
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setNewType(null)}
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

                    {caseFileTypes.map((type, index) => (
                      <Draggable key={type.id} draggableId={type.id} index={index}>
                        {(provided) => (
                          <TableRow
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={!type.is_active ? "opacity-50" : ""}
                          >
                            <TableCell {...provided.dragHandleProps} className="cursor-move">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                            <TableCell>
                              {editingType?.id === type.id ? (
                                <Input
                                  value={editingType.label}
                                  onChange={(e) => setEditingType({ ...editingType, label: e.target.value })}
                                  className="h-8"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full"
                                    style={{ backgroundColor: type.color }}
                                  />
                                  {(() => {
                                    const Icon = getIconComponent(type.icon);
                                    return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
                                  })()}
                                  {type.label}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingType?.id === type.id ? (
                                <TagIconPicker
                                  value={editingType.icon}
                                  onChange={(icon) => setEditingType({ ...editingType, icon })}
                                />
                              ) : (
                                (() => {
                                  const Icon = getIconComponent(type.icon);
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
                              {editingType?.id === type.id ? (
                                <input
                                  type="color"
                                  value={editingType.color}
                                  onChange={(e) => setEditingType({ ...editingType, color: e.target.value })}
                                  className="w-8 h-8 border border-border rounded cursor-pointer"
                                />
                              ) : (
                                <span
                                  className="inline-block w-8 h-8 rounded border border-border cursor-pointer"
                                  style={{ backgroundColor: type.color }}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                onClick={() => toggleActive(type.id, type.is_active)}
                                size="sm"
                                variant={type.is_active ? "default" : "secondary"}
                                className="h-6 px-2 text-xs"
                              >
                                {type.is_active ? 'Aktiv' : 'Inaktiv'}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {editingType?.id === type.id ? (
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
                                      onClick={() => setEditingType(null)}
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
                                      onClick={() => setEditingType({ id: type.id, label: type.label, color: type.color, icon: type.icon || undefined })}
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
                                          <AlertDialogTitle>Typ löschen</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Sind Sie sicher, dass Sie den Typ "{type.label}" löschen möchten? 
                                            FallAkten mit diesem Typ behalten ihren Wert, können aber nicht mehr gefiltert werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteCaseFileType(type.id)}>
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

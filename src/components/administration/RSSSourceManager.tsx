import { useState, useEffect } from "react";
import { Plus, GripVertical, Pencil, Trash2, TestTube, AlertCircle } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const rssSourceSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100),
  url: z.string().url("Ungültige URL"),
  category: z.string().min(1, "Kategorie ist erforderlich"),
});

type RSSSourceFormData = z.infer<typeof rssSourceSchema>;

interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
  order_index: number;
}

const CATEGORIES = [
  { value: "politik", label: "Politik" },
  { value: "wirtschaft", label: "Wirtschaft" },
  { value: "tech", label: "Technologie" },
  { value: "sport", label: "Sport" },
];

export function RSSSourceManager() {
  const { currentTenant } = useTenant();
  const [sources, setSources] = useState<RSSSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSource, setEditingSource] = useState<RSSSource | null>(null);
  const [deleteSource, setDeleteSource] = useState<RSSSource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingUrl, setTestingUrl] = useState(false);

  const form = useForm<RSSSourceFormData>({
    resolver: zodResolver(rssSourceSchema),
    defaultValues: {
      name: "",
      url: "",
      category: "politik",
    },
  });

  const loadSources = async () => {
    if (!currentTenant?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("rss_sources")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .order("order_index");

    if (error) {
      toast.error("Fehler beim Laden der RSS-Quellen");
      console.error(error);
    } else {
      setSources(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSources();
  }, [currentTenant?.id]);

  const onSubmit = async (data: RSSSourceFormData) => {
    if (!currentTenant?.id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingSource) {
        // Update
        const { error } = await supabase
          .from("rss_sources")
          .update({
            name: data.name,
            url: data.url,
            category: data.category,
          })
          .eq("id", editingSource.id);

        if (error) throw error;
        toast.success("RSS-Quelle aktualisiert");
      } else {
        // Create
        const maxOrder = sources.reduce((max, s) => Math.max(max, s.order_index), -1);
        const { error } = await supabase
          .from("rss_sources")
          .insert({
            tenant_id: currentTenant.id,
            name: data.name,
            url: data.url,
            category: data.category,
            order_index: maxOrder + 1,
            created_by: user.id,
          });

        if (error) throw error;
        toast.success("RSS-Quelle hinzugefügt");
      }

      loadSources();
      setDialogOpen(false);
      form.reset();
      setEditingSource(null);
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern");
      console.error(error);
    }
  };

  const handleToggleActive = async (source: RSSSource) => {
    const { error } = await supabase
      .from("rss_sources")
      .update({ is_active: !source.is_active })
      .eq("id", source.id);

    if (error) {
      toast.error("Fehler beim Aktualisieren des Status");
      console.error(error);
    } else {
      toast.success(source.is_active ? "Quelle deaktiviert" : "Quelle aktiviert");
      loadSources();
    }
  };

  const handleDelete = async () => {
    if (!deleteSource) return;

    const { error } = await supabase
      .from("rss_sources")
      .delete()
      .eq("id", deleteSource.id);

    if (error) {
      toast.error("Fehler beim Löschen");
      console.error(error);
    } else {
      toast.success("RSS-Quelle gelöscht");
      loadSources();
    }
    setDeleteSource(null);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(sources);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order_index
    const updates = items.map((item, index) => ({
      id: item.id,
      order_index: index,
    }));

    setSources(items);

    // Update in database
    for (const update of updates) {
      await supabase
        .from("rss_sources")
        .update({ order_index: update.order_index })
        .eq("id", update.id);
    }

    toast.success("Reihenfolge aktualisiert");
  };

  const testFeed = async () => {
    const url = form.getValues("url");
    if (!url) {
      toast.error("Bitte geben Sie eine URL ein");
      return;
    }

    setTestingUrl(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      if (text.includes("<rss") || text.includes("<feed")) {
        toast.success("RSS-Feed ist gültig!");
      } else {
        toast.error("Die URL scheint kein gültiger RSS-Feed zu sein");
      }
    } catch (error: any) {
      toast.error(`Fehler beim Testen: ${error.message}`);
    } finally {
      setTestingUrl(false);
    }
  };

  const openEditDialog = (source: RSSSource) => {
    setEditingSource(source);
    form.reset({
      name: source.name,
      url: source.url,
      category: source.category,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSource(null);
    form.reset();
    setDialogOpen(true);
  };

  if (!currentTenant) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Kein Mandant ausgewählt. Bitte wählen Sie einen Mandanten aus.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">RSS-Quellen</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie die RSS-News-Quellen für Ihren Mandanten
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Quelle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSource ? "RSS-Quelle bearbeiten" : "Neue RSS-Quelle"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. Tagesschau" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RSS Feed URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testFeed}
                    disabled={testingUrl}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Feed
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingSource ? "Aktualisieren" : "Hinzufügen"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">
          Lädt...
        </Card>
      ) : sources.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Keine RSS-Quellen vorhanden. Fügen Sie eine neue Quelle hinzu.
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sources">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {sources.map((source, index) => (
                  <Draggable key={source.id} draggableId={source.id} index={index}>
                    {(provided) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div {...provided.dragHandleProps}>
                            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{source.name}</span>
                              <Badge variant="secondary">{source.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {source.url}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={source.is_active}
                              onCheckedChange={() => handleToggleActive(source)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(source)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteSource(source)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <AlertDialog open={!!deleteSource} onOpenChange={() => setDeleteSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>RSS-Quelle löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Quelle "{deleteSource?.name}" wirklich löschen? Diese Aktion
              kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

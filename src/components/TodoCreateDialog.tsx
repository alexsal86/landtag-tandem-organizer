import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TodoCategory {
  id: string;
  label: string;
  color: string;
}

interface TodoCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTodoCreated: () => void;
}

export function TodoCreateDialog({ open, onOpenChange, onTodoCreated }: TodoCreateDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  
  // Form state
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  console.log('TodoCreateDialog render - open:', open, 'user:', user?.id);

  useEffect(() => {
    if (open) {
      console.log('Dialog opened, loading categories...');
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      console.log('Loading categories...');
      const { data, error } = await supabase
        .from('todo_categories')
        .select('id, label, color')
        .eq('is_active', true)
        .order('order_index');

      console.log('Categories result:', { data, error });
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Fehler",
        description: "Kategorien konnten nicht geladen werden.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', { title, categoryId });
    
    if (!title.trim() || !categoryId) {
      toast({
        title: "Fehler",
        description: "Bitte Titel und Kategorie eingeben.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase.from('todos').insert({
        user_id: user?.id,
        tenant_id: currentTenant?.id || '', // Use current tenant ID
        category_id: categoryId,
        title: title.trim(),
        assigned_to: assignedTo || null,
        due_date: dueDate || null
      });
      
      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "ToDo wurde erstellt."
      });

      setTitle("");
      setCategoryId("");
      setDueDate("");
      setAssignedTo("");
      onTodoCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating todo:', error);
      toast({
        title: "Fehler", 
        description: error.message || "ToDo konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neues ToDo erstellen</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel*</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ToDo-Titel eingeben..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategorie*</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie auswählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Fälligkeitsdatum (optional)</Label>
            <Input
              id="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Zuweisung (optional)</Label>
            <Input
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="An wen soll das ToDo zugewiesen werden?"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading || !title.trim() || !categoryId}
              className="flex-1"
            >
              {loading ? "Erstelle..." : "Erstellen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TodoCategory {
  id: string;
  label: string;
  color: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

interface TodoCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTodoCreated: () => void;
}

export function TodoCreateDialog({ open, onOpenChange, onTodoCreated }: TodoCreateDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Form state
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    console.log('Loading todo dialog data...');
    try {
      const [categoriesRes, profilesRes] = await Promise.all([
        supabase.from('todo_categories').select('id, label, color').eq('is_active', true).order('order_index'),
        supabase.from('profiles').select('user_id, display_name').order('display_name')
      ]);

      console.log('Categories loaded:', categoriesRes.data);
      console.log('Profiles loaded:', profilesRes.data);
      
      if (categoriesRes.error) {
        console.error('Categories error:', categoriesRes.error);
      }
      if (profilesRes.error) {
        console.error('Profiles error:', profilesRes.error);
      }

      setCategories(categoriesRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Fehler",
        description: "Daten konnten nicht geladen werden.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Todo form submitted with:', { title, categoryId, assignedTo, dueDate, user: user?.id });
    
    if (!title.trim() || !categoryId) {
      console.log('Validation failed:', { title: title.trim(), categoryId });
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const todoData = {
        user_id: user?.id,
        category_id: categoryId,
        title: title.trim(),
        assigned_to: assignedTo || null,
        due_date: dueDate?.toISOString() || null
      };

      console.log('Inserting todo data:', todoData);
      const { error } = await supabase.from('todos').insert(todoData);
      
      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Todo created successfully');
      toast({
        title: "Erfolgreich",
        description: "ToDo wurde erstellt."
      });

      // Reset form
      setTitle("");
      setCategoryId("");
      setAssignedTo("");
      setDueDate(undefined);
      
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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel*</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ToDo-Titel eingeben..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Kategorie*</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
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
            <Label htmlFor="assigned-to">Zuständigkeit</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Zuständigkeit auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Keine Zuständigkeit</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.user_id} value={profile.display_name || profile.user_id}>
                    {profile.display_name || 'Unbekannter Benutzer'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fälligkeitsdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "dd.MM.yyyy") : "Datum auswählen"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Erstelle..." : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
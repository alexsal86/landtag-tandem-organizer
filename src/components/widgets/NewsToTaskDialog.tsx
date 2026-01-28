import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckSquare, Loader2 } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
}

interface NewsToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: NewsArticle | null;
}

interface TaskCategory {
  name: string;
  label: string;
}

interface UserProfile {
  user_id: string;
  display_name: string;
}

export const NewsToTaskDialog: React.FC<NewsToTaskDialogProps> = ({
  open,
  onOpenChange,
  article
}) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    if (open && article) {
      setTitle(article.title);
      setDescription(
        `${article.description}\n\nQuelle: ${article.link}\nVon: ${article.source}`
      );
      loadData();
    }
  }, [open, article]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load categories from task_categories (not todo_categories)
      const { data: categoriesData } = await supabase
        .from('task_categories')
        .select('name, label')
        .eq('is_active', true)
        .order('order_index');

      setCategories(categoriesData || []);

      // Load users for assignment
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('display_name');

      setUsers(profiles || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      return;
    }

    if (!selectedCategory) {
      toast.error('Bitte wählen Sie eine Kategorie aus');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberships?.tenant_id) throw new Error('No tenant found');

      // Create task with news-import tag
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        tenant_id: memberships.tenant_id,
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        assigned_to: assignedTo.join(','),
        due_date: dueDate?.toISOString(),
        priority,
        status: 'todo',
        tags: ['news-import']
      });

      if (error) throw error;

      toast.success('Aufgabe erfolgreich erstellt');
      
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedCategory('');
      setAssignedTo([]);
      setDueDate(undefined);
      setPriority('medium');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Fehler beim Erstellen der Aufgabe');
    } finally {
      setLoading(false);
    }
  };

  const userOptions = users.map(u => ({
    value: u.user_id,
    label: u.display_name || 'Unbekannt'
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Aufgabe aus News erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Aufgaben-Titel"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aufgaben-Beschreibung"
              rows={6}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategorie *</Label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">Kategorie auswählen</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignment */}
          <div className="space-y-2">
            <Label>Zugewiesen an</Label>
            <MultiSelect
              options={userOptions}
              selected={assignedTo}
              onChange={setAssignedTo}
              placeholder="Benutzer auswählen..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
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
                    {dueDate ? format(dueDate, 'PP', { locale: de }) : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priorität</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              <>
                <CheckSquare className="mr-2 h-4 w-4" />
                Erstellen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

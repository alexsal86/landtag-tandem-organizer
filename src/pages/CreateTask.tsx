import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { MultiSelect } from "@/components/ui/multi-select-simple";

export default function CreateTask() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Array<{
    id: string;
    display_name: string | null;
    user_id: string;
    isCurrentUser: boolean;
  }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [taskCategories, setTaskCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [taskStatuses, setTaskStatuses] = useState<Array<{ name: string; label: string }>>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "personal", // Default to valid category
    dueDate: "",
    assignedTo: [] as string[], // Ensure this is always an array
  });

  console.log('🔍 CreateTask component render - formData:', formData);

  // Load user profiles and task configurations
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUserId(user.id);

        const [
          { data: profiles, error: profilesError },
          { data: categories, error: categoriesError },
          { data: statuses, error: statusesError }
        ] = await Promise.all([
          supabase.from('profiles').select('id, display_name, user_id').order('display_name'),
          supabase.from('task_categories').select('name, label').eq('is_active', true).order('order_index'),
          supabase.from('task_statuses').select('name, label').eq('is_active', true).order('order_index')
        ]);

        if (profilesError) throw profilesError;
        if (categoriesError) throw categoriesError;
        if (statusesError) throw statusesError;

        // Sort profiles with current user first
        const sortedProfiles = (profiles || []).map(profile => ({
          ...profile,
          isCurrentUser: profile.user_id === user.id
        })).sort((a, b) => {
          if (a.isCurrentUser) return -1;
          if (b.isCurrentUser) return 1;
          return 0;
        });

        setUserProfiles(sortedProfiles);
        setTaskCategories(categories || []);
        setTaskStatuses(statuses || []);

        // Set default category if available
        if (categories && categories.length > 0) {
          setFormData(prev => ({ ...prev, category: categories[0].name }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

      console.log('📝 Starting task creation process');
      console.log('📝 Current tenant:', currentTenant);
      console.log('📝 Form data:', formData);

      try {
        // Validate required fields
        if (!formData.title.trim()) {
          toast({
            title: "Fehler",
            description: "Bitte geben Sie einen Titel für die Aufgabe ein.",
            variant: "destructive",
          });
          return;
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('📝 User auth check:', { user: user?.id, error: userError });
        
        if (userError || !user) {
          console.error('❌ Auth error:', userError);
          toast({
            title: "Fehler",
            description: "Sie müssen angemeldet sein, um Aufgaben zu erstellen.",
            variant: "destructive",
          });
          return;
        }

        // Validate tenant
        if (!currentTenant?.id) {
          console.error('❌ No tenant available:', currentTenant);
          toast({
            title: "Fehler", 
            description: "Kein Tenant ausgewählt. Bitte laden Sie die Seite neu.",
            variant: "destructive",
          });
          return;
        }

        // TEST: Create task WITHOUT assigned_to field to isolate the problem
        const taskData = {
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          priority: formData.priority,
          category: formData.category || 'personal',
          due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
          user_id: user.id,
          status: "todo",
          tenant_id: currentTenant.id
          // TEMPORARILY REMOVED: assigned_to field to test
        };

        console.log('📝 Inserting task WITHOUT assigned_to field:', taskData);

        // Insert task
        const { data: insertedTask, error: insertError } = await supabase
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ Task creation error:', insertError);
          console.error('❌ Error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          
          throw new Error(insertError.message);
        }

        console.log('✅ Task created successfully WITHOUT assigned_to:', insertedTask);
        
        toast({
          title: "Aufgabe erstellt",
          description: "Die neue Aufgabe wurde erfolgreich erstellt (ohne Zuweisungen).",
        });

        // Reset form
        setFormData({
          title: "",
          description: "",
          priority: "medium",
          category: "personal",
          dueDate: "",
          assignedTo: [],
        });

        navigate("/tasks");
    } catch (error) {
      console.error('❌ Error creating task:', error);
      toast({
        title: "Fehler",
        description: `Aufgabe konnte nicht erstellt werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zu Aufgaben
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Neue Aufgabe erstellen</h1>
          <p className="text-muted-foreground">
            Erstellen Sie eine neue Aufgabe für Ihr Aufgabenmanagement
          </p>
        </div>

        {/* Form */}
        <Card className="bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle>Aufgabendetails</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Titel der Aufgabe eingeben..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detaillierte Beschreibung der Aufgabe..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorität</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Priorität wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskCategories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Fälligkeitsdatum (optional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Zugewiesen an (optional)</Label>
                   <MultiSelect
                    options={(userProfiles || []).map(profile => ({
                      value: profile.user_id,
                      label: profile.isCurrentUser ? "Ich" : (profile.display_name || "Unbekannter Nutzer")
                    }))}
                    selected={formData.assignedTo}
                    onChange={(value) => setFormData({ ...formData, assignedTo: Array.isArray(value) ? value.filter(id => id && id.trim() !== '') : [] })}
                    placeholder="Personen auswählen..."
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {loading ? "Wird erstellt..." : "Aufgabe erstellen"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
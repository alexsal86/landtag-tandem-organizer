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

export default function CreateTask() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Array<{
    id: string;
    display_name: string | null;
    user_id: string;
    isCurrentUser: boolean;
  }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "personal",
    dueDate: "",
    assignedTo: "",
  });

  // Load user profiles
  useEffect(() => {
    const loadUserProfiles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUserId(user.id);

        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, display_name, user_id')
          .order('display_name');

        if (error) throw error;

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
      } catch (error) {
        console.error('Error loading user profiles:', error);
      }
    };

    loadUserProfiles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Fehler",
          description: "Sie müssen angemeldet sein, um Aufgaben zu erstellen.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from('tasks').insert({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        category: formData.category,
        due_date: new Date(formData.dueDate).toISOString(),
        assigned_to: formData.assignedTo || null,
        user_id: user.id,
        status: "todo",
      });

      if (error) throw error;

      toast({
        title: "Aufgabe erstellt",
        description: "Die neue Aufgabe wurde erfolgreich erstellt.",
      });

      navigate("/");
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht erstellt werden.",
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
                      <SelectItem value="legislation">Gesetzgebung</SelectItem>
                      <SelectItem value="committee">Ausschuss</SelectItem>
                      <SelectItem value="constituency">Wahlkreis</SelectItem>
                      <SelectItem value="personal">Persönlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Fälligkeitsdatum *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Zugewiesen an</Label>
                  <Select
                    value={formData.assignedTo}
                    onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Person auswählen..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border z-50">
                      <SelectItem value="">Niemand zugewiesen</SelectItem>
                      {userProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.display_name || profile.user_id}>
                          {profile.isCurrentUser ? "Ich" : (profile.display_name || "Unbekannter Nutzer")}
                          {profile.isCurrentUser && " (Aktueller Nutzer)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
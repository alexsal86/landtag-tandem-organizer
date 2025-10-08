import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserBadge } from "@/components/ui/user-badge";
import { AVAILABLE_COLORS } from "@/utils/userColors";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
}

export const UserColorManager = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, badge_color')
        .order('display_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Fehler beim Laden",
        description: "Benutzer konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateUserColor = async (userId: string, color: string | null) => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ badge_color: color })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, badge_color: color } : u
      ));

      toast({
        title: "Farbe aktualisiert",
        description: "Die Benutzerfarbe wurde erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error updating user color:', error);
      toast({
        title: "Fehler",
        description: "Farbe konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const autoAssignColors = async () => {
    setLoading(true);
    try {
      const updates = users.map((user, index) => ({
        user_id: user.user_id,
        badge_color: AVAILABLE_COLORS[index % AVAILABLE_COLORS.length].value,
      }));

      for (const update of updates) {
        await supabase
          .from('profiles')
          .update({ badge_color: update.badge_color })
          .eq('user_id', update.user_id);
      }

      await loadUsers();
      
      toast({
        title: "Farben zugewiesen",
        description: `${users.length} Benutzern wurden automatisch Farben zugewiesen.`,
      });
    } catch (error) {
      console.error('Error auto-assigning colors:', error);
      toast({
        title: "Fehler",
        description: "Automatische Farbzuweisung fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetColors = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ badge_color: null })
        .in('user_id', users.map(u => u.user_id));

      if (error) throw error;

      await loadUsers();
      
      toast({
        title: "Farben zurückgesetzt",
        description: "Alle Benutzerfarben wurden entfernt.",
      });
    } catch (error) {
      console.error('Error resetting colors:', error);
      toast({
        title: "Fehler",
        description: "Farben konnten nicht zurückgesetzt werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benutzerfarben verwalten</CardTitle>
        <CardDescription>
          Weisen Sie jedem Benutzer eine Farbe zu, die in Badges und anderen UI-Elementen verwendet wird.
          Ohne zugewiesene Farbe wird automatisch eine konsistente Farbe basierend auf der Benutzer-ID generiert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-6">
          <Button 
            onClick={autoAssignColors} 
            disabled={loading}
            variant="outline"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Farben automatisch verteilen
          </Button>
          <Button 
            onClick={resetColors} 
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Alle Farben zurücksetzen
          </Button>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <div 
              key={user.user_id} 
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1">
                <UserBadge 
                  userId={user.user_id}
                  displayName={user.display_name}
                  badgeColor={user.badge_color}
                />
                <span className="text-sm text-muted-foreground">
                  {user.display_name || 'Unbekannt'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Select
                  value={user.badge_color || 'none'}
                  onValueChange={(value) => 
                    updateUserColor(user.user_id, value === 'none' ? null : value)
                  }
                  disabled={updating === user.user_id}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Farbe wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Automatisch (Hash)</SelectItem>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-4 h-4 rounded ${color.value}`}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {updating === user.user_id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

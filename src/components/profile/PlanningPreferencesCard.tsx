import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Plus, Trash2, Users, CalendarDays } from "lucide-react";

interface Collaborator {
  user_id: string;
  can_edit: boolean;
  display_name?: string;
  avatar_url?: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function PlanningPreferencesCard() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [defaultCollaborators, setDefaultCollaborators] = useState<Collaborator[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    if (user && currentTenant) {
      loadPreferences();
      loadAvailableUsers();
    }
  }, [user, currentTenant]);

  const loadPreferences = async () => {
    if (!user || !currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from("user_planning_preferences")
        .select("default_collaborators")
        .eq("user_id", user.id)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.default_collaborators && Array.isArray(data.default_collaborators)) {
        const collabs = data.default_collaborators as unknown as Collaborator[];
        // Enrich with profile data
        const enrichedCollabs = await enrichCollaborators(collabs);
        setDefaultCollaborators(enrichedCollabs);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const enrichCollaborators = async (collabs: Collaborator[]): Promise<Collaborator[]> => {
    if (collabs.length === 0) return [];
    
    const userIds = collabs.map(c => c.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    return collabs.map(c => {
      const profile = profiles?.find(p => p.user_id === c.user_id);
      return {
        ...c,
        display_name: profile?.display_name || "Unbekannt",
        avatar_url: profile?.avatar_url || undefined,
      };
    });
  };

  const loadAvailableUsers = async () => {
    if (!currentTenant) return;
    
    try {
      const { data, error } = await supabase
        .from("user_tenant_memberships")
        .select(`
          user_id,
          profiles!inner (
            user_id,
            display_name,
            avatar_url
          )
        `)
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true)
        .neq("user_id", user?.id);

      if (error) throw error;

      const profiles: Profile[] = (data || []).map((item: any) => ({
        user_id: item.profiles.user_id,
        display_name: item.profiles.display_name,
        avatar_url: item.profiles.avatar_url,
      }));

      setAvailableUsers(profiles);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const savePreferences = async (newCollabs: Collaborator[]) => {
    if (!user || !currentTenant) return;
    
    setIsSaving(true);
    try {
      // Only save user_id and can_edit
      const collabsToSave = newCollabs.map(c => ({
        user_id: c.user_id,
        can_edit: c.can_edit,
      }));

      const { error } = await supabase
        .from("user_planning_preferences")
        .upsert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          default_collaborators: collabsToSave,
        }, {
          onConflict: "user_id,tenant_id",
        });

      if (error) throw error;

      toast({
        title: "Gespeichert",
        description: "Ihre Planungs-Voreinstellungen wurden aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addCollaborator = async (profile: Profile) => {
    if (defaultCollaborators.some(c => c.user_id === profile.user_id)) {
      toast({
        title: "Bereits vorhanden",
        description: "Dieser Mitarbeiter ist bereits in der Liste.",
        variant: "destructive",
      });
      return;
    }

    const newCollab: Collaborator = {
      user_id: profile.user_id,
      can_edit: false,
      display_name: profile.display_name || "Unbekannt",
      avatar_url: profile.avatar_url || undefined,
    };

    const newCollabs = [...defaultCollaborators, newCollab];
    setDefaultCollaborators(newCollabs);
    await savePreferences(newCollabs);
    setIsAddDialogOpen(false);
  };

  const removeCollaborator = async (userId: string) => {
    const newCollabs = defaultCollaborators.filter(c => c.user_id !== userId);
    setDefaultCollaborators(newCollabs);
    await savePreferences(newCollabs);
  };

  const toggleCanEdit = async (userId: string, canEdit: boolean) => {
    const newCollabs = defaultCollaborators.map(c =>
      c.user_id === userId ? { ...c, can_edit: canEdit } : c
    );
    setDefaultCollaborators(newCollabs);
    await savePreferences(newCollabs);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const filteredAvailableUsers = availableUsers.filter(
    u => !defaultCollaborators.some(c => c.user_id === u.user_id)
  );

  if (isLoading) {
    return (
      <Card className="bg-card shadow-card border-border">
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Planungs-Voreinstellungen
        </CardTitle>
        <CardDescription>
          Wählen Sie Mitarbeiter, die bei neuen Veranstaltungs- und Terminplanungen automatisch hinzugefügt werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {defaultCollaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Keine Standard-Mitarbeiter festgelegt
          </p>
        ) : (
          <div className="space-y-3">
            {defaultCollaborators.map((collab) => (
              <div 
                key={collab.user_id} 
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={collab.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(collab.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{collab.display_name}</p>
                    <Badge 
                      variant={collab.can_edit ? "default" : "secondary"} 
                      className="text-xs mt-0.5"
                    >
                      {collab.can_edit ? "Kann bearbeiten" : "Nur ansehen"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Bearbeiten</span>
                    <Switch
                      checked={collab.can_edit}
                      onCheckedChange={(checked) => toggleCanEdit(collab.user_id, checked)}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCollaborator(collab.user_id)}
                    disabled={isSaving}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Mitarbeiter hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mitarbeiter auswählen
              </DialogTitle>
              <DialogDescription>
                Wählen Sie einen Mitarbeiter aus, der bei neuen Planungen automatisch hinzugefügt wird.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {filteredAvailableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Keine weiteren Mitarbeiter verfügbar
                  </p>
                ) : (
                  filteredAvailableUsers.map((profile) => (
                    <Button
                      key={profile.user_id}
                      variant="ghost"
                      className="w-full justify-start gap-3 h-auto py-3"
                      onClick={() => addCollaborator(profile)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(profile.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {profile.display_name || "Unbekannt"}
                      </span>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

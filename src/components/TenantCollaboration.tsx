import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Plus, Users, Check, X, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TenantCollaboration {
  id: string;
  tenant_a_id: string;
  tenant_b_id: string;
  is_active: boolean;
  approved_by_a?: string;
  approved_by_b?: string;
  collaboration_type: string;
  created_at: string;
  tenant_a?: { name: string };
  tenant_b?: { name: string };
}

export function TenantCollaboration() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [collaborations, setCollaborations] = useState<TenantCollaboration[]>([]);
  const [availableTenants, setAvailableTenants] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentTenant) {
      fetchCollaborations();
      fetchAvailableTenants();
    }
  }, [currentTenant]);

  const fetchCollaborations = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from("tenant_collaborations")
        .select(`
          *,
          tenant_a:tenants!tenant_collaborations_tenant_a_id_fkey(name),
          tenant_b:tenants!tenant_collaborations_tenant_b_id_fkey(name)
        `)
        .or(`tenant_a_id.eq.${currentTenant.id},tenant_b_id.eq.${currentTenant.id}`);

      if (error) {
        console.error("Error fetching collaborations:", error);
        return;
      }

      setCollaborations(data || []);
    } catch (error) {
      console.error("Error in fetchCollaborations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTenants = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, description")
        .neq("id", currentTenant.id)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching tenants:", error);
        return;
      }

      setAvailableTenants(data || []);
    } catch (error) {
      console.error("Error in fetchAvailableTenants:", error);
    }
  };

  const requestCollaboration = async () => {
    if (!currentTenant || !selectedTenantId || !user) return;

    try {
      const { data, error } = await supabase
        .from("tenant_collaborations")
        .insert({
          tenant_a_id: currentTenant.id,
          tenant_b_id: selectedTenantId,
          approved_by_a: user.id,
          collaboration_type: "project_sharing",
          is_active: false,
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Fehler",
          description: "Kollaborationsanfrage konnte nicht gesendet werden.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Kollaborationsanfrage wurde gesendet.",
      });

      setSelectedTenantId("");
      setIsCreateDialogOpen(false);
      fetchCollaborations();
    } catch (error) {
      console.error("Error requesting collaboration:", error);
    }
  };

  const approveCollaboration = async (collaborationId: string) => {
    if (!user || !currentTenant) return;

    try {
      const { data, error } = await supabase
        .from("tenant_collaborations")
        .update({
          approved_by_b: user.id,
          is_active: true,
        })
        .eq("id", collaborationId)
        .select()
        .single();

      if (error) {
        toast({
          title: "Fehler",
          description: "Kollaboration konnte nicht genehmigt werden.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Kollaboration wurde genehmigt.",
      });

      fetchCollaborations();
    } catch (error) {
      console.error("Error approving collaboration:", error);
    }
  };

  const rejectCollaboration = async (collaborationId: string) => {
    try {
      const { error } = await supabase
        .from("tenant_collaborations")
        .delete()
        .eq("id", collaborationId);

      if (error) {
        toast({
          title: "Fehler",
          description: "Kollaboration konnte nicht abgelehnt werden.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Erfolg",
        description: "Kollaboration wurde abgelehnt.",
      });

      fetchCollaborations();
    } catch (error) {
      console.error("Error rejecting collaboration:", error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Lädt...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Büro-Kollaborationen
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Kollaboration anfragen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Kollaboration mit anderem Büro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Büro auswählen</Label>
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Büro auswählen...</option>
                    {availableTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="p-4 bg-muted rounded-md">
                  <h4 className="font-medium mb-2">Was bedeutet Kollaboration?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Gemeinsame Planung von Veranstaltungen</li>
                    <li>• Austausch von Kontakten und Ressourcen</li>
                    <li>• Koordinierte Terminplanung</li>
                    <li>• Geteilte Projektarbeit</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={requestCollaboration}
                  disabled={!selectedTenantId}
                >
                  Anfrage senden
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {collaborations.length > 0 ? (
          <div className="space-y-3">
            {collaborations.map((collab) => {
              const isCurrentTenantA = collab.tenant_a_id === currentTenant?.id;
              const partnerTenant = isCurrentTenantA ? collab.tenant_b : collab.tenant_a;
              const needsApproval = !collab.is_active && !isCurrentTenantA && !collab.approved_by_b;
              const waitingForApproval = !collab.is_active && isCurrentTenantA && !collab.approved_by_b;

              return (
                <div key={collab.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{partnerTenant?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {collab.collaboration_type === "project_sharing" && "Projekt-Austausch"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {collab.is_active ? (
                      <Badge variant="default">Aktiv</Badge>
                    ) : needsApproval ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => approveCollaboration(collab.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => rejectCollaboration(collab.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : waitingForApproval ? (
                      <Badge variant="secondary">Wartet auf Genehmigung</Badge>
                    ) : (
                      <Badge variant="secondary">Ausstehend</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">Noch keine Kollaborationen</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Arbeiten Sie mit anderen Büros zusammen, um Projekte und Ressourcen zu teilen.
            </p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Erste Kollaboration anfragen
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
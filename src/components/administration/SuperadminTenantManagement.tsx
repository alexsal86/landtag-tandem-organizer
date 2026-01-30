import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Building2, Plus, Edit, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface TenantWithStats {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
}

export function SuperadminTenantManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithStats | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Superadmin-Check (hardcoded für mail@alexander-salomon.de)
  const isSuperadmin = user?.email === "mail@alexander-salomon.de";

  const loadTenants = async () => {
    try {
      // Lade Tenants mit User-Count
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          id,
          name,
          description,
          is_active,
          created_at
        `)
        .order("name");

      if (error) throw error;

      // User-Counts laden
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("is_active", true);

      const countMap = new Map<string, number>();
      (memberships || []).forEach(m => {
        countMap.set(m.tenant_id, (countMap.get(m.tenant_id) || 0) + 1);
      });

      const tenantsWithStats = (data || []).map(t => ({
        ...t,
        user_count: countMap.get(t.id) || 0,
      }));

      setTenants(tenantsWithStats);
    } catch (error) {
      console.error("Error loading tenants:", error);
      toast({ title: "Fehler", description: "Tenants konnten nicht geladen werden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperadmin) {
      loadTenants();
    }
  }, [isSuperadmin]);

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Fehler", description: "Name ist erforderlich", variant: "destructive" });
      return;
    }

    try {
      if (editingTenant) {
        // Update
        const { error } = await supabase
          .from("tenants")
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTenant.id);

        if (error) throw error;
        toast({ title: "Gespeichert", description: "Tenant wurde aktualisiert" });
      } else {
        // Create
        const { error } = await supabase
          .from("tenants")
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_active: formIsActive,
            settings: {},
          });

        if (error) throw error;
        toast({ title: "Erstellt", description: "Neuer Tenant wurde angelegt" });
      }

      setDialogOpen(false);
      resetForm();
      loadTenants();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (tenant: TenantWithStats) => {
    if (tenant.user_count > 0) {
      toast({ 
        title: "Nicht möglich", 
        description: `Tenant hat noch ${tenant.user_count} Benutzer. Bitte erst alle Benutzer entfernen.`,
        variant: "destructive" 
      });
      return;
    }

    if (!confirm(`Tenant "${tenant.name}" wirklich löschen?`)) return;

    try {
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", tenant.id);

      if (error) throw error;
      toast({ title: "Gelöscht", description: "Tenant wurde entfernt" });
      loadTenants();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const openCreateDialog = () => {
    setEditingTenant(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tenant: TenantWithStats) => {
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormDescription(tenant.description || "");
    setFormIsActive(tenant.is_active);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setEditingTenant(null);
  };

  if (!isSuperadmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine Berechtigung für diesen Bereich.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant-Verwaltung
          </CardTitle>
          <CardDescription>
            Verwaltung aller Mandanten im System
          </CardDescription>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Tenant
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Laden...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-center">Benutzer</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {tenant.description || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {tenant.user_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={tenant.is_active ? "default" : "outline"}>
                      {tenant.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(tenant.created_at), "dd.MM.yyyy", { locale: de })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(tenant)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tenant)}
                        disabled={tenant.user_count > 0}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Keine Tenants vorhanden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTenant ? "Tenant bearbeiten" : "Neuer Tenant"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z.B. Büro Mustermann"
                />
              </div>
              <div className="grid gap-2">
                <Label>Beschreibung</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optionale Beschreibung..."
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktiv</Label>
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave}>
                {editingTenant ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

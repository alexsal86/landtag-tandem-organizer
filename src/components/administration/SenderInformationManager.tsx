import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building, Star } from "lucide-react";

export function SenderInformationManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [senderInfos, setSenderInfos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingInfo, setEditingInfo] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    sender_name: "",
    sender_email: "",
    is_default: false
  });

  useEffect(() => {
    if (currentTenant) fetchSenderInfos();
  }, [currentTenant]);

  const fetchSenderInfos = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sender_information')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      if (error) throw error;
      setSenderInfos(data || []);
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (info: any) => {
    setEditingInfo(info);
    setFormData({
      sender_name: info.name || "",
      sender_email: info.landtag_email || "",
      is_default: info.is_default || false,
    });
    setShowDialog(true);
  };

  const openCreateDialog = () => {
    setEditingInfo(null);
    setFormData({ sender_name: "", sender_email: "", is_default: false });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // If setting as default, unset all others first
      if (formData.is_default) {
        await supabase
          .from('sender_information')
          .update({ is_default: false })
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true);
      }
      
      if (editingInfo) {
        const { error } = await supabase
          .from('sender_information')
          .update({
            name: formData.sender_name,
            organization: formData.sender_name,
            landtag_email: formData.sender_email,
            is_default: formData.is_default,
          })
          .eq('id', editingInfo.id);
        if (error) throw error;
        toast({ title: "Absender aktualisiert" });
      } else {
        const { error } = await supabase
          .from('sender_information')
          .insert({
            name: formData.sender_name,
            organization: formData.sender_name,
            landtag_email: formData.sender_email,
            is_default: formData.is_default,
            tenant_id: currentTenant.id,
            is_active: true,
            created_by: user.id,
          });
        if (error) throw error;
        toast({ title: "Absender erstellt" });
      }
      setShowDialog(false);
      setEditingInfo(null);
      fetchSenderInfos();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sender_information')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Absender gelöscht" });
      setDeleteConfirmId(null);
      fetchSenderInfos();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!currentTenant) return;
    try {
      // Unset all defaults
      await supabase
        .from('sender_information')
        .update({ is_default: false })
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      // Set new default
      const { error } = await supabase
        .from('sender_information')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Standard-Absender gesetzt" });
      fetchSenderInfos();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Absender-Einstellungen</h2>
        <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />Neuer Absender</Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingInfo(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingInfo ? "Absender bearbeiten" : "Neuer Absender"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={formData.sender_name} onChange={(e) => setFormData({...formData, sender_name: e.target.value})} /></div>
            <div><Label>E-Mail</Label><Input value={formData.sender_email} onChange={(e) => setFormData({...formData, sender_email: e.target.value})} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_default} onCheckedChange={(checked) => setFormData({...formData, is_default: checked})} />
              <Label>Als Standard</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={loading}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Absender löschen?</AlertDialogTitle>
            <AlertDialogDescription>Dieser Absender wird deaktiviert und steht nicht mehr zur Verfügung.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4">
        {senderInfos.map((info) => (
          <Card key={info.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  {info.name}
                  {info.is_default && <Badge variant="default" className="text-xs">Standard</Badge>}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {!info.is_default && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(info.id)} title="Als Standard setzen">
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(info)} title="Bearbeiten">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirmId(info.id)} title="Löschen">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{info.landtag_email}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building } from "lucide-react";

export function SenderInformationManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [senderInfos, setSenderInfos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingInfo, setEditingInfo] = useState<any>(null);
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

  const handleSubmit = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const data = { ...formData, tenant_id: currentTenant.id, is_active: true };
      if (editingInfo) {
        await supabase.from('sender_information').update(data).eq('id', editingInfo.id);
        toast({ title: "Absender aktualisiert" });
      } else {
        await supabase.from('sender_information').insert(data);
        toast({ title: "Absender erstellt" });
      }
      setShowDialog(false);
      fetchSenderInfos();
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Absender-Einstellungen</h2>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Neuer Absender</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Absender verwalten</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={formData.sender_name} onChange={(e) => setFormData({...formData, sender_name: e.target.value})} /></div>
              <div><Label>E-Mail</Label><Input value={formData.sender_email} onChange={(e) => setFormData({...formData, sender_email: e.target.value})} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_default} onCheckedChange={(checked) => setFormData({...formData, is_default: checked})} />
                <Label>Als Standard</Label>
              </div>
              <Button onClick={handleSubmit} disabled={loading}>Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4">
        {senderInfos.map((info) => (
          <Card key={info.id}>
            <CardHeader><CardTitle><Building className="h-5 w-5 inline mr-2" />{info.sender_name}</CardTitle></CardHeader>
            <CardContent><p>{info.sender_email}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

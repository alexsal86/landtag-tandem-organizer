import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building, Star, MapPin, Phone, Globe } from "lucide-react";

interface SenderFormData {
  name: string;
  organization: string;
  return_address_line: string;
  landtag_street: string;
  landtag_house_number: string;
  landtag_postal_code: string;
  landtag_city: string;
  landtag_email: string;
  wahlkreis_street: string;
  wahlkreis_house_number: string;
  wahlkreis_postal_code: string;
  wahlkreis_city: string;
  wahlkreis_email: string;
  phone: string;
  fax: string;
  website: string;
  facebook_profile: string;
  instagram_profile: string;
  is_default: boolean;
}

interface SenderInformationRecord {
  id: string;
  name?: string | null;
  organization?: string | null;
  return_address_line?: string | null;
  landtag_street?: string | null;
  landtag_house_number?: string | null;
  landtag_postal_code?: string | null;
  landtag_city?: string | null;
  landtag_email?: string | null;
  wahlkreis_street?: string | null;
  wahlkreis_house_number?: string | null;
  wahlkreis_postal_code?: string | null;
  wahlkreis_city?: string | null;
  wahlkreis_email?: string | null;
  phone?: string | null;
  fax?: string | null;
  website?: string | null;
  facebook_profile?: string | null;
  instagram_profile?: string | null;
  is_default?: boolean | null;
}

const EMPTY_FORM: SenderFormData = {
  name: "", organization: "", return_address_line: "",
  landtag_street: "", landtag_house_number: "", landtag_postal_code: "", landtag_city: "", landtag_email: "",
  wahlkreis_street: "", wahlkreis_house_number: "", wahlkreis_postal_code: "", wahlkreis_city: "", wahlkreis_email: "",
  phone: "", fax: "", website: "", facebook_profile: "", instagram_profile: "",
  is_default: false,
};

function SenderFormField({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
}

export function SenderInformationManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [senderInfos, setSenderInfos] = useState<SenderInformationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingInfo, setEditingInfo] = useState<SenderInformationRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SenderFormData>(EMPTY_FORM);

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
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (info: SenderInformationRecord) => {
    setEditingInfo(info);
    setFormData({
      name: info.name || "",
      organization: info.organization || "",
      return_address_line: info.return_address_line || "",
      landtag_street: info.landtag_street || "",
      landtag_house_number: info.landtag_house_number || "",
      landtag_postal_code: info.landtag_postal_code || "",
      landtag_city: info.landtag_city || "",
      landtag_email: info.landtag_email || "",
      wahlkreis_street: info.wahlkreis_street || "",
      wahlkreis_house_number: info.wahlkreis_house_number || "",
      wahlkreis_postal_code: info.wahlkreis_postal_code || "",
      wahlkreis_city: info.wahlkreis_city || "",
      wahlkreis_email: info.wahlkreis_email || "",
      phone: info.phone || "",
      fax: info.fax || "",
      website: info.website || "",
      facebook_profile: info.facebook_profile || "",
      instagram_profile: info.instagram_profile || "",
      is_default: info.is_default || false,
    });
    setShowDialog(true);
  };

  const openCreateDialog = () => {
    setEditingInfo(null);
    setFormData(EMPTY_FORM);
    setShowDialog(true);
  };

  const updateField = (key: keyof SenderFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (formData.is_default) {
        await supabase.from('sender_information').update({ is_default: false }).eq('tenant_id', currentTenant.id).eq('is_active', true);
      }

      const payload = {
        name: formData.name,
        organization: formData.organization,
        return_address_line: formData.return_address_line,
        landtag_street: formData.landtag_street,
        landtag_house_number: formData.landtag_house_number,
        landtag_postal_code: formData.landtag_postal_code,
        landtag_city: formData.landtag_city,
        landtag_email: formData.landtag_email,
        wahlkreis_street: formData.wahlkreis_street,
        wahlkreis_house_number: formData.wahlkreis_house_number,
        wahlkreis_postal_code: formData.wahlkreis_postal_code,
        wahlkreis_city: formData.wahlkreis_city,
        wahlkreis_email: formData.wahlkreis_email,
        phone: formData.phone,
        fax: formData.fax,
        website: formData.website,
        facebook_profile: formData.facebook_profile,
        instagram_profile: formData.instagram_profile,
        is_default: formData.is_default,
      };

      if (editingInfo) {
        const { error } = await supabase.from('sender_information').update(payload).eq('id', editingInfo.id);
        if (error) throw error;
        toast({ title: "Absender aktualisiert" });
      } else {
        const { error } = await supabase.from('sender_information').insert([{
          ...payload,
          tenant_id: currentTenant.id,
          is_active: true,
          created_by: user.id,
        }]);
        if (error) throw error;
        toast({ title: "Absender erstellt" });
      }
      setShowDialog(false);
      setEditingInfo(null);
      fetchSenderInfos();
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('sender_information').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      toast({ title: "Absender gelöscht" });
      setDeleteConfirmId(null);
      fetchSenderInfos();
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!currentTenant) return;
    try {
      await supabase.from('sender_information').update({ is_default: false }).eq('tenant_id', currentTenant.id).eq('is_active', true);
      const { error } = await supabase.from('sender_information').update({ is_default: true }).eq('id', id);
      if (error) throw error;
      toast({ title: "Standard-Absender gesetzt" });
      fetchSenderInfos();
    } catch (error: unknown) {
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  };

  const formatAddress = (street: string, houseNr: string, plz: string, city: string) => {
    const parts = [street && houseNr ? `${street} ${houseNr}` : street, plz && city ? `${plz} ${city}` : city].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Absender-Einstellungen</h3>
        <Button size="sm" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />Neuer Absender</Button>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingInfo(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle>{editingInfo ? "Absender bearbeiten" : "Neuer Absender"}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Allgemein */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Allgemein</h4>
                <div className="grid grid-cols-2 gap-3">
                  <SenderFormField label="Name" value={formData.name} onChange={(v) => updateField('name', v)} placeholder="Max Mustermann" />
                  <SenderFormField label="Organisation" value={formData.organization} onChange={(v) => updateField('organization', v)} placeholder="Fraktion XY" />
                </div>
                <SenderFormField label="Rücksendezeile" value={formData.return_address_line} onChange={(v) => updateField('return_address_line', v)} placeholder="Fraktion XY · Platz 1 · 00000 Stadt" />
                <div className="flex items-center gap-2">
                  <Switch checked={formData.is_default} onCheckedChange={(checked) => updateField('is_default', checked)} />
                  <Label className="text-sm">Als Standard-Absender</Label>
                </div>
              </div>

              <Separator />

              {/* Landtag-Adresse */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Landtag-Adresse</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><SenderFormField label="Straße" value={formData.landtag_street} onChange={(v) => updateField('landtag_street', v)} /></div>
                  <SenderFormField label="Hausnr." value={formData.landtag_house_number} onChange={(v) => updateField('landtag_house_number', v)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <SenderFormField label="PLZ" value={formData.landtag_postal_code} onChange={(v) => updateField('landtag_postal_code', v)} />
                  <div className="col-span-2"><SenderFormField label="Stadt" value={formData.landtag_city} onChange={(v) => updateField('landtag_city', v)} /></div>
                </div>
                <SenderFormField label="E-Mail" value={formData.landtag_email} onChange={(v) => updateField('landtag_email', v)} type="email" />
              </div>

              <Separator />

              {/* Wahlkreis-Adresse */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Wahlkreis-Adresse</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><SenderFormField label="Straße" value={formData.wahlkreis_street} onChange={(v) => updateField('wahlkreis_street', v)} /></div>
                  <SenderFormField label="Hausnr." value={formData.wahlkreis_house_number} onChange={(v) => updateField('wahlkreis_house_number', v)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <SenderFormField label="PLZ" value={formData.wahlkreis_postal_code} onChange={(v) => updateField('wahlkreis_postal_code', v)} />
                  <div className="col-span-2"><SenderFormField label="Stadt" value={formData.wahlkreis_city} onChange={(v) => updateField('wahlkreis_city', v)} /></div>
                </div>
                <SenderFormField label="E-Mail" value={formData.wahlkreis_email} onChange={(v) => updateField('wahlkreis_email', v)} type="email" />
              </div>

              <Separator />

              {/* Kontakt */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Kontakt</h4>
                <div className="grid grid-cols-2 gap-3">
                  <SenderFormField label="Telefon" value={formData.phone} onChange={(v) => updateField('phone', v)} type="tel" />
                  <SenderFormField label="Fax" value={formData.fax} onChange={(v) => updateField('fax', v)} type="tel" />
                </div>
                <SenderFormField label="Website" value={formData.website} onChange={(v) => updateField('website', v)} type="url" placeholder="https://..." />
              </div>

              <Separator />

              {/* Social Media */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Social Media</h4>
                <div className="grid grid-cols-2 gap-3">
                  <SenderFormField label="Facebook" value={formData.facebook_profile} onChange={(v) => updateField('facebook_profile', v)} placeholder="facebook.com/..." />
                  <SenderFormField label="Instagram" value={formData.instagram_profile} onChange={(v) => updateField('instagram_profile', v)} placeholder="instagram.com/..." />
                </div>
              </div>
            </div>
          </ScrollArea>
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

      <div className="grid gap-3">
        {senderInfos.map((info) => {
          const landtagAddr = formatAddress(info.landtag_street ?? '', info.landtag_house_number ?? '', info.landtag_postal_code ?? '', info.landtag_city ?? '');
          const wahlkreisAddr = formatAddress(info.wahlkreis_street ?? '', info.wahlkreis_house_number ?? '', info.wahlkreis_postal_code ?? '', info.wahlkreis_city ?? '');
          return (
            <Card key={info.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {info.name}
                    {info.organization && info.organization !== info.name && (
                      <span className="text-muted-foreground font-normal">· {info.organization}</span>
                    )}
                    {info.is_default && <Badge variant="default" className="text-xs">Standard</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {!info.is_default && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSetDefault(info.id)} title="Als Standard setzen">
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(info)} title="Bearbeiten">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirmId(info.id)} title="Löschen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {info.landtag_email && <p>{info.landtag_email}</p>}
                  {landtagAddr && <p>Landtag: {landtagAddr}</p>}
                  {wahlkreisAddr && <p>Wahlkreis: {wahlkreisAddr}</p>}
                  {info.phone && <p>Tel: {info.phone}</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {senderInfos.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">Noch keine Absender angelegt.</p>
        )}
      </div>
    </div>
  );
}

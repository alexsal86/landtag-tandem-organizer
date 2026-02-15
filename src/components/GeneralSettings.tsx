import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Save, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { DashboardDefaultCover } from "./administration/DashboardDefaultCover";
import { CelebrationSettingsCard } from "./administration/CelebrationSettingsCard";

interface AppSettings {
  app_name: string;
  app_subtitle: string;
  app_logo_url: string;
}

export function GeneralSettings() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [settings, setSettings] = useState<AppSettings>({
    app_name: "LandtagsOS",
    app_subtitle: "Koordinationssystem",
    app_logo_url: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [logoCacheBuster, setLogoCacheBuster] = useState(Date.now());

  // Load current settings for this tenant
  useEffect(() => {
    if (!currentTenant?.id) return;
    
    const loadSettings = async () => {
      try {
        // First load tenant-specific settings
        const { data: tenantData, error } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .eq('tenant_id', currentTenant.id)
          .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

        if (error) throw error;

        const tenantSettings = (tenantData || []).reduce((acc, item) => {
          const key = item.setting_key as keyof AppSettings;
          acc[key] = item.setting_value || '';
          return acc;
        }, {} as Partial<AppSettings>);

        const hasAllTenantValues = Boolean(
          tenantSettings.app_name && tenantSettings.app_subtitle && tenantSettings.app_logo_url
        );

        // If tenant settings are incomplete, fill missing values from global defaults.
        // Important: do not fail the whole page when global settings are not accessible.
        let globalSettings: Partial<AppSettings> = {};
        if (!hasAllTenantValues) {
          const { data: globalData, error: globalError } = await supabase
            .from('app_settings')
            .select('setting_key, setting_value')
            .is('tenant_id', null)
            .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

          if (!globalError) {
            globalSettings = (globalData || []).reduce((acc, item) => {
              const key = item.setting_key as keyof AppSettings;
              acc[key] = item.setting_value || '';
              return acc;
            }, {} as Partial<AppSettings>);
          } else {
            console.warn('Global app settings fallback not available:', globalError);
          }
        }

        setSettings({
          app_name: tenantSettings.app_name || globalSettings.app_name || "LandtagsOS",
          app_subtitle: tenantSettings.app_subtitle || globalSettings.app_subtitle || "Koordinationssystem",
          app_logo_url: tenantSettings.app_logo_url || globalSettings.app_logo_url || ""
        });
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: "Fehler",
          description: "Einstellungen konnten nicht geladen werden.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toast, currentTenant?.id]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
    const fileExtension = (file.name.split('.').pop() || '').toLowerCase();
    const hasAllowedType = !!file.type && allowedTypes.includes(file.type);
    const hasAllowedExtension = allowedExtensions.includes(fileExtension);

    if (!hasAllowedType && !hasAllowedExtension) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Bilddatei aus (JPG, PNG, GIF, SVG, WebP).",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Fehler", 
        description: "Die Datei ist zu groß. Maximal 2MB erlaubt.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = (file.name.split('.').pop() || "png").toLowerCase();
      const fileName = `app-logo-${currentTenant?.id}-${Date.now()}.${fileExt}`;
      const inferredContentType = file.type || (fileExt === "svg" ? "image/svg+xml" : undefined);

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: inferredContentType
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setLogoLoadFailed(false);
      setLogoCacheBuster(Date.now());
      setSettings(prev => ({ ...prev, app_logo_url: urlData.publicUrl }));
      
      toast({
        title: "Erfolgreich",
        description: "Logo wurde hochgeladen."
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Fehler",
        description: `Logo konnte nicht hochgeladen werden: ${error.message || 'Unbekannter Fehler'}`,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    setLogoLoadFailed(false);
    setLogoCacheBuster(Date.now());
  }, [settings.app_logo_url]);

  const logoPreviewUrl = settings.app_logo_url
    ? `${settings.app_logo_url}${settings.app_logo_url.includes('?') ? '&' : '?'}v=${logoCacheBuster}`
    : "";

  const saveSettings = async () => {
    if (!currentTenant?.id) {
      toast({
        title: "Fehler",
        description: "Kein Mandant ausgewählt.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const updates = [
        { tenant_id: currentTenant.id, setting_key: 'app_name', setting_value: settings.app_name },
        { tenant_id: currentTenant.id, setting_key: 'app_subtitle', setting_value: settings.app_subtitle },
        { tenant_id: currentTenant.id, setting_key: 'app_logo_url', setting_value: settings.app_logo_url }
      ];

      for (const update of updates) {
        // Delete existing if any, then insert
        await supabase
          .from('app_settings')
          .delete()
          .eq('tenant_id', currentTenant.id)
          .eq('setting_key', update.setting_key);

        const { error } = await supabase
          .from('app_settings')
          .insert(update);
        
        if (error) throw error;
      }

      toast({
        title: "Gespeichert",
        description: "Einstellungen wurden erfolgreich gespeichert."
      });

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Fehler", 
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Allgemeine Einstellungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app_name">Name der Anwendung</Label>
            <Input
              id="app_name"
              value={settings.app_name}
              onChange={(e) => setSettings(prev => ({ ...prev, app_name: e.target.value }))}
              placeholder="z.B. LandtagsOS"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app_subtitle">Untertitel</Label>
            <Input
              id="app_subtitle"
              value={settings.app_subtitle}
              onChange={(e) => setSettings(prev => ({ ...prev, app_subtitle: e.target.value }))}
              placeholder="z.B. Koordinationssystem"
            />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
            {settings.app_logo_url && !logoLoadFailed ? (
              <div className="h-20 w-20 rounded-lg border bg-muted/30 p-2 flex items-center justify-center">
                <img
                  src={logoPreviewUrl}
                  alt="App Logo"
                  className="max-h-16 max-w-16 object-contain"
                  onError={() => {
                    console.error("Logo konnte nicht geladen werden:", settings.app_logo_url);
                    setLogoLoadFailed(true);
                  }}
                />
              </div>
            ) : (
              <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
              
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/svg+xml,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Hochladen..." : "Logo hochladen"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Unterstützte Formate: JPG, PNG, GIF, SVG, WebP. Max. 2MB
                </p>
              </div>
            </div>
          </div>
        </div>

          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Speichern..." : "Einstellungen speichern"}
          </Button>
        </CardContent>
      </Card>

      {/* Dashboard Default Cover */}
      <DashboardDefaultCover />

      {/* Celebration Animations Settings */}
      <CelebrationSettingsCard />
    </div>
  );
}

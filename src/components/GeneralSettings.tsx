import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload, Save, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  app_name: string;
  app_subtitle: string;
  app_logo_url: string;
}

export function GeneralSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>({
    app_name: "LandtagsOS",
    app_subtitle: "Koordinationssystem",
    app_logo_url: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['app_name', 'app_subtitle', 'app_logo_url']);

        if (error) throw error;

        const settingsMap = data?.reduce((acc, item) => {
          const key = item.setting_key as keyof AppSettings;
          acc[key] = item.setting_value || '';
          return acc;
        }, {
          app_name: '',
          app_subtitle: '',
          app_logo_url: ''
        } as AppSettings) || {
          app_name: '',
          app_subtitle: '',
          app_logo_url: ''
        };

        setSettings({
          app_name: settingsMap.app_name || "LandtagsOS",
          app_subtitle: settingsMap.app_subtitle || "Koordinationssystem", 
          app_logo_url: settingsMap.app_logo_url || ""
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
  }, [toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - allow common image formats including SVG
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Bilddatei aus (JPG, PNG, GIF, SVG, WebP).",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 2MB)
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
      const fileExt = file.name.split('.').pop();
      const fileName = `app-logo-${Date.now()}.${fileExt}`;
      
      console.log('Starting file upload:', fileName, 'Size:', file.size);
      
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('Upload successful:', data);

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', urlData.publicUrl);

      setSettings(prev => ({ ...prev, app_logo_url: urlData.publicUrl }));
      
      toast({
        title: "Erfolgreich",
        description: "Logo wurde hochgeladen."
      });
    } catch (error) {
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

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { setting_key: 'app_name', setting_value: settings.app_name },
        { setting_key: 'app_subtitle', setting_value: settings.app_subtitle },
        { setting_key: 'app_logo_url', setting_value: settings.app_logo_url }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(update, { onConflict: 'setting_key' });
        
        if (error) throw error;
      }

      toast({
        title: "Gespeichert",
        description: "Einstellungen wurden erfolgreich gespeichert."
      });

      // Reload the page to show updated navigation
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
              {settings.app_logo_url ? (
                <img 
                  src={settings.app_logo_url} 
                  alt="App Logo" 
                  className="h-16 w-16 object-contain"
                />
              ) : (
                <div className="h-16 w-16 rounded-md border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
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
  );
}
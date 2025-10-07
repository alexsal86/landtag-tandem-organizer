import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { UnsplashImagePicker } from '@/components/dashboard/UnsplashImagePicker';
import { Palette, Type, Settings as SettingsIcon } from 'lucide-react';

export function LoginCustomization() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [customization, setCustomization] = useState({
    background_image_url: 'https://images.unsplash.com/photo-1584974292709-5c2f0619971b?w=1920&q=80',
    background_position: 'center',
    background_attribution: null as any,
    primary_color: '#57ab27',
    accent_color: '#E6007E',
    tagline: 'Ihre politische Arbeit. Organisiert.',
    welcome_text: 'Willkommen bei LandtagsOS',
    footer_text: '© 2025 LandtagsOS',
    social_login_enabled: false,
    registration_enabled: true,
    password_reset_enabled: true
  });
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  useEffect(() => {
    if (currentTenant?.id) {
      loadData();
    }
  }, [currentTenant?.id]);

  const loadData = async () => {
    if (!currentTenant?.id) return;

    try {
      setLoading(true);

      // Load logo from app_settings
      const { data: logoData } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'app_logo_url')
        .maybeSingle();

      if (logoData?.setting_value) {
        setLogoUrl(logoData.setting_value);
      }

      // Load login customization
      const { data: customData } = await supabase
        .from('login_customization')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (customData) {
        setCustomization({
          background_image_url: customData.background_image_url || customization.background_image_url,
          background_position: customData.background_position || 'center',
          background_attribution: customData.background_attribution,
          primary_color: customData.primary_color || '#57ab27',
          accent_color: customData.accent_color || '#E6007E',
          tagline: customData.tagline || customization.tagline,
          welcome_text: customData.welcome_text || customization.welcome_text,
          footer_text: customData.footer_text || customization.footer_text,
          social_login_enabled: customData.social_login_enabled ?? false,
          registration_enabled: customData.registration_enabled ?? true,
          password_reset_enabled: customData.password_reset_enabled ?? true
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fehler',
        description: 'Daten konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;

    try {
      setSaving(true);

      // Upsert login customization
      const { error } = await supabase
        .from('login_customization')
        .upsert({
          tenant_id: currentTenant.id,
          logo_url: logoUrl || null,
          ...customization
        }, {
          onConflict: 'tenant_id'
        });

      if (error) throw error;

      toast({
        title: 'Gespeichert',
        description: 'Login-Anpassungen wurden erfolgreich gespeichert.'
      });
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Speichern fehlgeschlagen.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Lädt...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Login-Anpassung</CardTitle>
        <CardDescription>
          Passen Sie das Erscheinungsbild der Login-Seite an
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="branding" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="branding">
              <Palette className="h-4 w-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="content">
              <Type className="h-4 w-4 mr-2" />
              Inhalte
            </TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Einstellungen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoUrl && (
                <div className="mb-2">
                  <img 
                    src={logoUrl} 
                    alt="Current Logo" 
                    className="h-16 w-auto object-contain border rounded p-2"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Das Logo wird aus den allgemeinen App-Einstellungen verwendet. 
                Ändern Sie es unter Administration → Allgemeine Einstellungen.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hintergrundbild</Label>
              {customization.background_image_url && (
                <div className="mb-2 relative h-48 rounded-lg overflow-hidden border">
                  <img 
                    src={customization.background_image_url} 
                    alt="Background" 
                    className="w-full h-full object-cover"
                    style={{ objectPosition: customization.background_position }}
                  />
                </div>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setImagePickerOpen(true)}
              >
                Hintergrundbild ändern
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primärfarbe</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={customization.primary_color}
                    onChange={(e) => setCustomization({ ...customization, primary_color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={customization.primary_color}
                    onChange={(e) => setCustomization({ ...customization, primary_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Akzentfarbe</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent-color"
                    type="color"
                    value={customization.accent_color}
                    onChange={(e) => setCustomization({ ...customization, accent_color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={customization.accent_color}
                    onChange={(e) => setCustomization({ ...customization, accent_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={customization.tagline}
                onChange={(e) => setCustomization({ ...customization, tagline: e.target.value })}
                placeholder="Ihre politische Arbeit. Organisiert."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcome">Willkommenstext</Label>
              <Input
                id="welcome"
                value={customization.welcome_text}
                onChange={(e) => setCustomization({ ...customization, welcome_text: e.target.value })}
                placeholder="Willkommen bei LandtagsOS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer">Footer-Text</Label>
              <Input
                id="footer"
                value={customization.footer_text}
                onChange={(e) => setCustomization({ ...customization, footer_text: e.target.value })}
                placeholder="© 2025 LandtagsOS"
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Registrierung aktivieren</Label>
                <p className="text-sm text-muted-foreground">
                  Neue Benutzer können sich selbst registrieren
                </p>
              </div>
              <Switch
                checked={customization.registration_enabled}
                onCheckedChange={(checked) => 
                  setCustomization({ ...customization, registration_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Passwort-Reset aktivieren</Label>
                <p className="text-sm text-muted-foreground">
                  Benutzer können ihr Passwort zurücksetzen
                </p>
              </div>
              <Switch
                checked={customization.password_reset_enabled}
                onCheckedChange={(checked) => 
                  setCustomization({ ...customization, password_reset_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Social-Login aktivieren</Label>
                <p className="text-sm text-muted-foreground">
                  Login mit Google, GitHub, etc. (aktuell nicht implementiert)
                </p>
              </div>
              <Switch
                checked={customization.social_login_enabled}
                onCheckedChange={(checked) => 
                  setCustomization({ ...customization, social_login_enabled: checked })
                }
                disabled
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Speichert...' : 'Änderungen speichern'}
          </Button>
        </div>

        <UnsplashImagePicker
          isOpen={imagePickerOpen}
          onClose={() => setImagePickerOpen(false)}
          onSave={(url, position, attribution) => {
            setCustomization({
              ...customization,
              background_image_url: url,
              background_position: position as string,
              background_attribution: attribution
            });
            setImagePickerOpen(false);
          }}
          currentUrl={customization.background_image_url || ''}
          currentPosition={
            (customization.background_position === 'top' || 
             customization.background_position === 'bottom') 
              ? customization.background_position 
              : 'center'
          }
        />
      </CardContent>
    </Card>
  );
}

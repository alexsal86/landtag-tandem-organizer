import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Bell, Shield, Globe, User, Save, Volume2, Calendar, Mail, Activity, ClipboardList } from "lucide-react";
import { NotificationSettings } from "./NotificationSettings";
import { ExternalCalendarSettings } from "./ExternalCalendarSettings";
import { TwoFactorSettings } from "./TwoFactorSettings";
import { SenderInformationManager } from "./administration/SenderInformationManager";
import { AutoStatusDetection } from "./AutoStatusDetection";
import { useMyWorkSettings, BadgeDisplayMode } from "@/hooks/useMyWorkSettings";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [language, setLanguage] = useState("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // My Work Settings
  const { badgeDisplayMode, updateBadgeDisplayMode, isLoading: myWorkSettingsLoading } = useMyWorkSettings();

  useEffect(() => {
    if (!user) return;
    const loadUserData = async () => {
      const { data: adminData } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(!!adminData);
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setUserProfile(profile);
    };
    loadUserData();
  }, [user]);

  const handleSaveSettings = () => {
    toast({
      title: "Einstellungen gespeichert",
      description: "Ihre Einstellungen wurden erfolgreich gespeichert.",
    });
  };

  const themeOptions = [
    { value: "light", label: "Hell", icon: Sun },
    { value: "dark", label: "Dunkel", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Einstellungen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Systemeinstellungen und Präferenzen
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appearance Settings */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Darstellung
              </CardTitle>
              <CardDescription>
                Passen Sie das Aussehen der Anwendung an
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Design-Modus</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Design auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="language">Sprache</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Deutsch
                      </div>
                    </SelectItem>
                    <SelectItem value="en">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        English
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Zeitzone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Berlin">Europa/Berlin</SelectItem>
                    <SelectItem value="Europe/Vienna">Europa/Wien</SelectItem>
                    <SelectItem value="Europe/Zurich">Europa/Zürich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System
              </CardTitle>
              <CardDescription>
                Allgemeine Systemeinstellungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-save">Automatisches Speichern</Label>
                  <p className="text-sm text-muted-foreground">
                    Änderungen automatisch speichern
                  </p>
                </div>
                <Switch
                  id="auto-save"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Benutzerprofil</Label>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile?.avatar_url} />
                    <AvatarFallback>
                      {userProfile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{userProfile?.display_name || user?.email}</p>
                    <p className="text-sm text-muted-foreground">{userProfile?.role || 'Benutzer'}</p>
                  </div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/profile/edit")}
              >
                <User className="h-4 w-4 mr-2" />
                Profil bearbeiten
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* My Work Settings */}
        <div className="mt-6">
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Meine Arbeit
              </CardTitle>
              <CardDescription>
                Einstellungen für die Anzeige in "Meine Arbeit"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="badge-display-mode">Tab-Badge Anzeige</Label>
                <Select 
                  value={badgeDisplayMode} 
                  onValueChange={(value) => {
                    updateBadgeDisplayMode(value as BadgeDisplayMode);
                    toast({
                      title: "Einstellung gespeichert",
                      description: value === 'new' 
                        ? "Badges zeigen jetzt nur neue Elemente an." 
                        : "Badges zeigen jetzt die Gesamtzahl an.",
                    });
                  }}
                  disabled={myWorkSettingsLoading}
                >
                  <SelectTrigger id="badge-display-mode">
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      <div className="flex flex-col items-start">
                        <span>Nur neue Elemente anzeigen (Standard)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="total">
                      <div className="flex flex-col items-start">
                        <span>Gesamtzahl der Elemente anzeigen</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Wählen Sie, ob die Badges die Anzahl neuer oder aller Elemente anzeigen sollen.
                  Bei "Nur neue Elemente" wird die Zahl nach dem Besuch eines Tabs zurückgesetzt.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Auto Status Detection */}
        <div className="mt-6">
          <AutoStatusDetection />
        </div>

        {/* Notification Settings */}
        <div className="mt-6">
          <NotificationSettings />
        </div>

        {/* Two-Factor Authentication */}
        <div className="mt-6">
          <TwoFactorSettings />
        </div>

        {/* Additional Settings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Privacy & Security */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Datenschutz & Sicherheit
              </CardTitle>
              <CardDescription>
                Verwalten Sie Ihre Datenschutz- und Sicherheitseinstellungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Passwort ändern
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Datenschutzeinstellungen
              </Button>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                Datenverwaltung
              </CardTitle>
              <CardDescription>
                Verwalten Sie Ihre Daten und Backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Save className="h-4 w-4 mr-2" />
                Daten exportieren
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Save className="h-4 w-4 mr-2" />
                Backup erstellen
              </Button>
              <Button variant="destructive" className="w-full justify-start">
                <Save className="h-4 w-4 mr-2" />
                Alle Daten löschen
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* External Calendar Settings - Full Width */}
        <div className="mt-6">
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Externe Kalender
              </CardTitle>
              <CardDescription>
                Verwalten Sie Ihre Google Calendar, Outlook und andere ICS-Kalender Integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExternalCalendarSettings />
            </CardContent>
          </Card>
        </div>
        
        {/* Sender Information Settings - Admin Only */}
        {isAdmin && (
          <div className="mt-6">
            <Card className="bg-card shadow-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Absender-Einstellungen
                </CardTitle>
                <CardDescription>
                  Verwalten Sie E-Mail-Absender-Konfigurationen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SenderInformationManager />
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button onClick={handleSaveSettings} className="gap-2">
            <Save className="h-4 w-4" />
            Einstellungen speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
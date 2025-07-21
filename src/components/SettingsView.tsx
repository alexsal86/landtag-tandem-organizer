import { useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Bell, Shield, Globe, User, Save, Volume2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [language, setLanguage] = useState("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          {/* Notification Settings */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Benachrichtigungen
              </CardTitle>
              <CardDescription>
                Steuern Sie, wie Sie benachrichtigt werden
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications">Push-Benachrichtigungen</Label>
                  <p className="text-sm text-muted-foreground">
                    Erhalten Sie Benachrichtigungen im Browser
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-alerts">E-Mail Benachrichtigungen</Label>
                  <p className="text-sm text-muted-foreground">
                    Wichtige Updates per E-Mail erhalten
                  </p>
                </div>
                <Switch
                  id="email-alerts"
                  checked={emailAlerts}
                  onCheckedChange={setEmailAlerts}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound">Sound-Benachrichtigungen</Label>
                  <p className="text-sm text-muted-foreground">
                    Akustische Signale bei Benachrichtigungen
                  </p>
                </div>
                <Switch
                  id="sound"
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
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
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Max Kellner</p>
                    <p className="text-sm text-muted-foreground">MdL - Wahlkreis 42</p>
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full">
                <User className="h-4 w-4 mr-2" />
                Profil bearbeiten
              </Button>
            </CardContent>
          </Card>
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
                Zwei-Faktor-Authentifizierung
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
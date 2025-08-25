import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Copy, Eye, EyeOff } from "lucide-react";

interface DemoUser {
  email: string;
  displayName: string;
  role: string;
  password: string;
}

export const CreateDemoUsers = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [createdUsers, setCreatedUsers] = useState<DemoUser[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);

  const createDemoUsers = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-demo-users');
      
      if (error) {
        console.error('Error creating demo users:', error);
        toast.error('Fehler beim Erstellen der Demo-Benutzer');
        return;
      }

      if (data.success) {
        setCreatedUsers(data.users);
        toast.success(data.message);
      } else {
        toast.error('Unbekannter Fehler beim Erstellen der Demo-Benutzer');
      }
    } catch (error) {
      console.error('Function call error:', error);
      toast.error('Fehler beim Aufruf der Funktion');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('In Zwischenablage kopiert');
  };

  const copyAllCredentials = () => {
    const credentials = createdUsers.map(user => 
      `${user.displayName} (${user.role})\nE-Mail: ${user.email}\nPasswort: ${user.password}\n`
    ).join('\n');
    
    copyToClipboard(credentials);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Demo-Benutzer erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Demo-Benutzer für Büro Erwin erstellen</DialogTitle>
        </DialogHeader>
        
        {createdUsers.length === 0 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Erstelle Demo-Mitarbeiter für das Büro Erwin um die Kollaborationsfunktionen zu testen.
            </p>
            <p className="text-sm text-muted-foreground">
              Es werden folgende Benutzer erstellt:
            </p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• Julia Müller (Büroleiterin)</li>
              <li>• Thomas Weber (Mitarbeiter)</li>
              <li>• Sarah Klein (Mitarbeiterin)</li>
              <li>• Michael Schmidt (Praktikant)</li>
            </ul>
            <Button 
              onClick={createDemoUsers} 
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? 'Erstelle Benutzer...' : 'Demo-Benutzer erstellen'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Erstellte Demo-Benutzer</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="gap-2"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPasswords ? 'Passwörter verstecken' : 'Passwörter anzeigen'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAllCredentials}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Alle kopieren
                </Button>
              </div>
            </div>
            
            <div className="grid gap-4">
              {createdUsers.map((user, index) => (
                <Card key={index} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{user.displayName}</CardTitle>
                      <Badge variant="secondary">{user.role}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">E-Mail:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{user.email}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(user.email)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Passwort:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {showPasswords ? user.password : '••••••••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(user.password)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Wichtig:</strong> Speichere diese Zugangsdaten sicher. Die Passwörter können später über die Benutzerverwaltung geändert werden.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
import React, { useState, useEffect } from 'react';
import { Loader2, Save, TestTube, CheckCircle, XCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMatrixClient } from '@/contexts/MatrixClientContext';

export function MatrixLoginForm() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isConnected, connect, disconnect, credentials } = useMatrixClient();

  const [matrixUserId, setMatrixUserId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [homeserverUrl, setHomeserverUrl] = useState('https://matrix.org');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Load existing credentials
  useEffect(() => {
    const loadCredentials = async () => {
      if (!user || !currentTenant?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('matrix_user_id, matrix_access_token, matrix_homeserver_url')
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();

        if (profile) {
          setMatrixUserId(profile.matrix_user_id || '');
          setAccessToken(profile.matrix_access_token || '');
          setHomeserverUrl(profile.matrix_homeserver_url || 'https://matrix.org');
        }
      } catch (error) {
        console.error('Error loading Matrix credentials:', error);
      }
    };

    loadCredentials();
  }, [user, currentTenant?.id]);

  const validateInputs = () => {
    if (!matrixUserId.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie Ihre Matrix User ID ein',
        variant: 'destructive'
      });
      return false;
    }

    if (!matrixUserId.startsWith('@') || !matrixUserId.includes(':')) {
      toast({
        title: 'Ungültige Matrix User ID',
        description: 'Format: @benutzername:server.tld',
        variant: 'destructive'
      });
      return false;
    }

    if (!accessToken.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie Ihren Access Token ein',
        variant: 'destructive'
      });
      return false;
    }

    if (!homeserverUrl.trim() || !homeserverUrl.startsWith('http')) {
      toast({
        title: 'Ungültige Homeserver URL',
        description: 'Format: https://matrix.example.org',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateInputs() || !user || !currentTenant?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          matrix_user_id: matrixUserId.trim(),
          matrix_access_token: accessToken.trim(),
          matrix_homeserver_url: homeserverUrl.trim()
        })
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      toast({
        title: 'Gespeichert',
        description: 'Matrix-Zugangsdaten wurden gespeichert'
      });

      // Try to connect with new credentials
      await connect({
        userId: matrixUserId.trim(),
        accessToken: accessToken.trim(),
        homeserverUrl: homeserverUrl.trim()
      });

    } catch (error) {
      console.error('Error saving Matrix credentials:', error);
      toast({
        title: 'Fehler',
        description: 'Zugangsdaten konnten nicht gespeichert werden',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateInputs()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // Try to connect with the credentials
      await connect({
        userId: matrixUserId.trim(),
        accessToken: accessToken.trim(),
        homeserverUrl: homeserverUrl.trim()
      });

      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      setTestResult('success');
      toast({
        title: 'Test erfolgreich',
        description: 'Verbindung zu Matrix wurde hergestellt'
      });
    } catch (error) {
      console.error('Matrix connection test failed:', error);
      setTestResult('error');
      toast({
        title: 'Test fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Verbindung konnte nicht hergestellt werden',
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: 'Getrennt',
      description: 'Matrix-Verbindung wurde getrennt'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Matrix Chat-Verbindung
        </CardTitle>
        <CardDescription>
          Verbinden Sie Ihren Matrix-Account für den integrierten Chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Verbunden als {credentials?.userId}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="matrix-user-id">Matrix User ID</Label>
            <Input
              id="matrix-user-id"
              placeholder="@benutzername:server.tld"
              value={matrixUserId}
              onChange={(e) => setMatrixUserId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ihre vollständige Matrix-Benutzer-ID
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matrix-access-token">Access Token</Label>
            <Input
              id="matrix-access-token"
              type="password"
              placeholder="syt_xxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sie finden Ihren Access Token in den Element-Einstellungen unter "Alle Einstellungen" → "Hilfe & Info"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="matrix-homeserver">Homeserver URL</Label>
            <Input
              id="matrix-homeserver"
              placeholder="https://matrix.org"
              value={homeserverUrl}
              onChange={(e) => setHomeserverUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Die URL Ihres Matrix-Homeservers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
          
          <Button onClick={handleTest} variant="outline" disabled={isTesting}>
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : testResult === 'success' ? (
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            ) : testResult === 'error' ? (
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Verbindung testen
          </Button>

          {isConnected && (
            <Button onClick={handleDisconnect} variant="destructive">
              Trennen
            </Button>
          )}
        </div>

        {/* Setup help */}
        <div className="p-4 bg-muted/50 rounded-lg mt-4">
          <h4 className="font-medium mb-2 text-sm">So finden Sie Ihren Access Token:</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Öffnen Sie Element (oder einen anderen Matrix-Client)</li>
            <li>Gehen Sie zu Einstellungen → Alle Einstellungen</li>
            <li>Klicken Sie auf "Hilfe & Info"</li>
            <li>Scrollen Sie zu "Erweitert"</li>
            <li>Klicken Sie auf "Access Token" (mit Vorsicht behandeln!)</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

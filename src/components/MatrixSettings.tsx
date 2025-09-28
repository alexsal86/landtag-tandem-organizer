import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, TestTube, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MatrixSubscription {
  id: string;
  user_id: string;
  room_id: string;
  matrix_username: string;
  is_active: boolean;
  created_at: string;
}

interface MatrixSettings {
  matrix_enabled: boolean;
}

export const MatrixSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [subscriptions, setSubscriptions] = useState<MatrixSubscription[]>([]);
  const [settings, setSettings] = useState<MatrixSettings>({ matrix_enabled: false });
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  
  // Form state for new subscription
  const [newRoom, setNewRoom] = useState('');
  const [newUsername, setNewUsername] = useState('');

  // Load existing subscriptions and settings
  useEffect(() => {
    const loadMatrixData = async () => {
      if (!user) return;

      try {
        // Load subscriptions
        const { data: subs, error: subsError } = await supabase
          .from('matrix_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (subsError) {
          console.error('Error loading Matrix subscriptions:', subsError);
        } else {
          setSubscriptions(subs || []);
        }

        // Load settings
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_notification_settings')
          .select('matrix_enabled')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error loading Matrix settings:', settingsError);
        } else {
          setSettings({ 
            matrix_enabled: userSettings?.matrix_enabled || false 
          });
        }
      } catch (error) {
        console.error('Error loading Matrix data:', error);
        toast({
          title: 'Fehler',
          description: 'Matrix-Einstellungen konnten nicht geladen werden.',
          variant: 'destructive',
        });
      }
    };

    loadMatrixData();
  }, [user, toast]);

  // Add new Matrix subscription
  const addSubscription = async () => {
    if (!user || !newRoom.trim() || !newUsername.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte füllen Sie alle Felder aus.',
        variant: 'destructive',
      });
      return;
    }

    // Validate room ID format
    if (!newRoom.startsWith('!') || !newRoom.includes(':')) {
      toast({
        title: 'Ungültige Raum-ID',
        description: 'Matrix-Raum-IDs müssen mit ! beginnen und einen Doppelpunkt enthalten (z.B. !example:matrix.org)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matrix_subscriptions')
        .insert({
          user_id: user.id,
          room_id: newRoom.trim(),
          matrix_username: newUsername.trim(),
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding Matrix subscription:', error);
        toast({
          title: 'Fehler',
          description: 'Matrix-Abonnement konnte nicht hinzugefügt werden: ' + error.message,
          variant: 'destructive',
        });
        return;
      }

      setSubscriptions(prev => [data, ...prev]);
      setNewRoom('');
      setNewUsername('');
      
      toast({
        title: 'Erfolgreich',
        description: 'Matrix-Abonnement wurde hinzugefügt.',
      });
    } catch (error) {
      console.error('Error adding subscription:', error);
      toast({
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Remove subscription
  const removeSubscription = async (subscriptionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('matrix_subscriptions')
        .delete()
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error removing subscription:', error);
        toast({
          title: 'Fehler',
          description: 'Abonnement konnte nicht entfernt werden.',
          variant: 'destructive',
        });
        return;
      }

      setSubscriptions(prev => prev.filter(sub => sub.id !== subscriptionId));
      toast({
        title: 'Entfernt',
        description: 'Matrix-Abonnement wurde entfernt.',
      });
    } catch (error) {
      console.error('Error removing subscription:', error);
      toast({
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle subscription active state
  const toggleSubscription = async (subscriptionId: string, isActive: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('matrix_subscriptions')
        .update({ is_active: isActive })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error updating subscription:', error);
        toast({
          title: 'Fehler',
          description: 'Abonnement-Status konnte nicht geändert werden.',
          variant: 'destructive',
        });
        return;
      }

      setSubscriptions(prev => prev.map(sub => 
        sub.id === subscriptionId 
          ? { ...sub, is_active: isActive }
          : sub
      ));

      toast({
        title: 'Aktualisiert',
        description: `Matrix-Abonnement wurde ${isActive ? 'aktiviert' : 'deaktiviert'}.`,
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Update global Matrix settings
  const updateMatrixEnabled = async (enabled: boolean) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: user.id,
          notification_type_id: '380fab61-2f1a-40d1-bed8-d34925544397', // Default type
          matrix_enabled: enabled,
          is_enabled: true,
          push_enabled: false,
          email_enabled: false
        }, {
          onConflict: 'user_id,notification_type_id'
        });

      if (error) {
        console.error('Error updating Matrix settings:', error);
        toast({
          title: 'Fehler',
          description: 'Matrix-Einstellungen konnten nicht gespeichert werden.',
          variant: 'destructive',
        });
        return;
      }

      setSettings({ matrix_enabled: enabled });
      toast({
        title: 'Gespeichert',
        description: `Matrix-Benachrichtigungen wurden ${enabled ? 'aktiviert' : 'deaktiviert'}.`,
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Test Matrix integration
  const testMatrixIntegration = async () => {
    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('matrix-bot-handler', {
        body: {
          test: true,
          title: 'Matrix-Test',
          message: 'Dies ist eine Test-Nachricht aus der Matrix-Integration!'
        }
      });

      if (error) {
        console.error('Error testing Matrix:', error);
        toast({
          title: 'Test fehlgeschlagen',
          description: 'Matrix-Test konnte nicht durchgeführt werden: ' + error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Test erfolgreich',
        description: data.message || 'Matrix-Test wurde erfolgreich durchgeführt!',
      });
    } catch (error) {
      console.error('Error testing Matrix:', error);
      toast({
        title: 'Test fehlgeschlagen',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Matrix-Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Erhalten Sie Benachrichtigungen in Matrix-Räumen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Matrix toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Matrix-Benachrichtigungen aktivieren</Label>
            <p className="text-sm text-muted-foreground">
              Aktivieren Sie Matrix-Nachrichten für alle konfigurierten Räume
            </p>
          </div>
          <Switch
            checked={settings.matrix_enabled}
            onCheckedChange={updateMatrixEnabled}
            disabled={loading}
          />
        </div>

        {/* Test button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={testMatrixIntegration}
            disabled={testLoading || subscriptions.length === 0}
            variant="outline"
            size="sm"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testLoading ? 'Teste...' : 'Matrix-Integration testen'}
          </Button>
        </div>

        {/* Add new subscription */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-medium">Neuen Matrix-Raum hinzufügen</h4>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="matrix-room">Matrix-Raum-ID</Label>
              <Input
                id="matrix-room"
                placeholder="!beispiel:matrix.org"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: !raumname:server.tld (z.B. !beispiel:matrix.org)
              </p>
            </div>
            <div>
              <Label htmlFor="matrix-username">Ihr Matrix-Benutzername</Label>
              <Input
                id="matrix-username"
                placeholder="@benutzer:matrix.org"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: @benutzername:server.tld
              </p>
            </div>
          </div>
          <Button 
            onClick={addSubscription} 
            disabled={loading || !newRoom.trim() || !newUsername.trim()}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Raum hinzufügen
          </Button>
        </div>

        {/* Current subscriptions */}
        <div className="space-y-4">
          <h4 className="font-medium">Aktive Matrix-Räume</h4>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Matrix-Räume konfiguriert.
            </p>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((subscription) => (
                <div 
                  key={subscription.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{subscription.room_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Benutzer: {subscription.matrix_username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={subscription.is_active}
                      onCheckedChange={(checked) => 
                        toggleSubscription(subscription.id, checked)
                      }
                      disabled={loading}
                    />
                    <Button
                      onClick={() => removeSubscription(subscription.id)}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setup instructions */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Einrichtungshinweise</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>1. Erstellen Sie einen Matrix-Bot-Account</p>
            <p>2. Laden Sie den Bot in Ihren gewünschten Raum ein</p>
            <p>3. Geben Sie die Raum-ID und Ihren Benutzernamen ein</p>
            <p>4. Aktivieren Sie Matrix-Benachrichtigungen</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
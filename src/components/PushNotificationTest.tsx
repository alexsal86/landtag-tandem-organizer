import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';

export const PushNotificationTest: React.FC = () => {
  const [testResult, setTestResult] = useState<{
    step: string;
    status: 'pending' | 'success' | 'error';
    message: string;
  } | null>(null);
  
  const { 
    pushSupported, 
    pushPermission, 
    requestPushPermission, 
    subscribeToPush 
  } = useNotifications();
  
  const { toast } = useToast();

  const runPushTest = async () => {
    try {
      setTestResult({ step: 'Starte Push-Test...', status: 'pending', message: '' });

      // Step 1: Check browser support
      setTestResult({ 
        step: 'Browser-Support prüfen', 
        status: pushSupported ? 'success' : 'error',
        message: pushSupported ? 'Push-Notifications werden unterstützt' : 'Browser unterstützt keine Push-Notifications'
      });

      if (!pushSupported) return;

      // Step 2: Request permission
      setTestResult({ step: 'Berechtigung anfordern', status: 'pending', message: 'Warte auf Benutzer-Berechtigung...' });
      
      const permission = await requestPushPermission();
      setTestResult({ 
        step: 'Berechtigung anfordern', 
        status: permission ? 'success' : 'error',
        message: permission ? 'Berechtigung erteilt' : 'Berechtigung verweigert'
      });

      if (!permission) return;

      // Step 3: Subscribe to push
      setTestResult({ step: 'Push-Subscription erstellen', status: 'pending', message: 'Erstelle Subscription...' });
      
      await subscribeToPush();
      setTestResult({ 
        step: 'Push-Subscription erstellen', 
        status: 'success',
        message: 'Subscription erfolgreich erstellt'
      });

      // Step 4: Test notification creation
      setTestResult({ step: 'Test-Benachrichtigung senden', status: 'pending', message: 'Sende Test-Benachrichtigung...' });

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { 
          test: true,
          title: 'Push-Test erfolgreich!',
          message: 'Das Push-Notification System funktioniert korrekt.',
          priority: 'high'
        }
      });

      if (error) {
        setTestResult({ 
          step: 'Test-Benachrichtigung senden', 
          status: 'error',
          message: `Fehler beim Senden: ${error.message}`
        });
        return;
      }

      setTestResult({ 
        step: 'Test-Benachrichtigung senden', 
        status: 'success',
        message: 'Test-Benachrichtigung erfolgreich gesendet! Prüfen Sie Ihre Benachrichtigungen.'
      });

      toast({
        title: "Push-Test erfolgreich!",
        description: "Das Push-Notification System funktioniert korrekt.",
      });

    } catch (error) {
      console.error('Push test error:', error);
      setTestResult({ 
        step: 'Fehler', 
        status: 'error',
        message: `Unerwarteter Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
    }
  };

  const getStatusColor = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push-Notification Test
        </CardTitle>
        <CardDescription>
          Testen Sie das Push-Notification System
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Browser-Support:</span>
            <Badge variant={pushSupported ? "default" : "destructive"}>
              {pushSupported ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {pushSupported ? 'Unterstützt' : 'Nicht unterstützt'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Berechtigung:</span>
            <Badge variant={pushPermission === 'granted' ? "default" : pushPermission === 'denied' ? "destructive" : "secondary"}>
              {pushPermission === 'granted' ? 'Erteilt' : 
               pushPermission === 'denied' ? 'Verweigert' : 'Nicht angefordert'}
            </Badge>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-lg border ${getStatusColor(testResult.status)}`}>
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(testResult.status)}
              <span className="font-medium text-sm">{testResult.step}</span>
            </div>
            {testResult.message && (
              <p className="text-xs opacity-90">{testResult.message}</p>
            )}
          </div>
        )}

        {/* Test Button */}
        <Button 
          onClick={runPushTest} 
          className="w-full"
          disabled={!pushSupported || testResult?.status === 'pending'}
        >
          {testResult?.status === 'pending' ? 'Test läuft...' : 'Push-Test starten'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Dieser Test prüft die komplette Push-Notification Pipeline: Browser-Support, 
          Berechtigungen, Subscription-Erstellung und Benachrichtigungsversand.
        </p>
      </CardContent>
    </Card>
  );
};
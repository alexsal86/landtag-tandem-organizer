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
        message: pushSupported ? '✅ Push-Notifications werden unterstützt' : '❌ Browser unterstützt keine Push-Notifications'
      });

      if (!pushSupported) return;

      // Step 2: Request permission if needed
      if (pushPermission !== 'granted') {
        setTestResult({ step: 'Berechtigung anfordern', status: 'pending', message: 'Fordere Push-Berechtigung an...' });
        
        try {
          const permission = await requestPushPermission();
          setTestResult({ 
            step: 'Berechtigung anfordern', 
            status: permission ? 'success' : 'error',
            message: permission ? '✅ Berechtigung erfolgreich erteilt' : '❌ Berechtigung verweigert'
          });

          if (!permission) return;
        } catch (error) {
          setTestResult({ 
            step: 'Berechtigung anfordern', 
            status: 'error',
            message: `❌ Fehler beim Anfordern der Berechtigung: ${error.message}`
          });
          return;
        }
      } else {
        setTestResult({ 
          step: 'Berechtigung prüfen', 
          status: 'success',
          message: '✅ Push-Berechtigung bereits erteilt'
        });
      }

      // Step 3: Subscribe to push
      setTestResult({ step: 'Push-Subscription erstellen', status: 'pending', message: 'Erstelle Subscription...' });
      
      try {
        await subscribeToPush();
        setTestResult({ 
          step: 'Push-Subscription erstellen', 
          status: 'success',
          message: '✅ Subscription erfolgreich erstellt'
        });
      } catch (error) {
        console.error('Push subscription error:', error);
        setTestResult({ 
          step: 'Push-Subscription erstellen', 
          status: 'error',
          message: `❌ Fehler beim Erstellen der Subscription: ${error.message}`
        });
        return;
      }

      // Step 4: Test notification creation
      setTestResult({ step: 'Test-Benachrichtigung senden', status: 'pending', message: 'Sende Test-Benachrichtigung...' });

      console.log('🚀 Invoking push notification test...');
      
      const response = await supabase.functions.invoke('send-push-notification', {
        body: { 
          type: 'test',
          title: 'Push-Test erfolgreich! 🎉',
          message: 'Das Push-Notification System funktioniert korrekt.',
          priority: 'high'
        }
      });

      console.log('📤 Edge Function response:', response);

      if (response.error) {
        console.error('❌ Edge Function error:', response.error);
        let errorMessage = '❌ Unbekannter Fehler beim Senden der Test-Benachrichtigung';
        
        if (response.error.message) {
          if (response.error.message.includes('401') || response.error.message.includes('Unauthorized')) {
            errorMessage = '⚠️ Authentifizierungsproblem - Test läuft trotzdem';
          } else if (response.error.message.includes('VAPID')) {
            errorMessage = '❌ VAPID-Konfigurationsfehler auf dem Server';
          } else if (response.error.message.includes('Missing')) {
            errorMessage = '❌ Server-Konfigurationsfehler';
          } else {
            errorMessage = `❌ Edge Function Fehler: ${response.error.message}`;
          }
        } else if (typeof response.error === 'string') {
          errorMessage = `❌ ${response.error}`;
        }
        
        setTestResult({ 
          step: 'Test-Benachrichtigung senden', 
          status: 'error',
          message: errorMessage
        });

        toast({
          title: "Push-Test fehlgeschlagen",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (!response.data) {
        console.error('❌ No data received from Edge Function');
        setTestResult({ 
          step: 'Test-Benachrichtigung senden', 
          status: 'error',
          message: '❌ Keine Antwort von der Edge Function erhalten'
        });

        toast({
          title: "Push-Test fehlgeschlagen",
          description: "Keine Antwort vom Server erhalten",
          variant: "destructive",
        });
        return;
      }

      const { success, sent, failed, total_subscriptions, results, error: dataError } = response.data;
      
      if (dataError) {
        console.error('❌ Server error:', dataError);
        setTestResult({ 
          step: 'Test-Benachrichtigung senden', 
          status: 'error',
          message: `❌ Server Fehler: ${dataError}`
        });

        toast({
          title: "Push-Test fehlgeschlagen",
          description: `Server Fehler: ${dataError}`,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Push notification test response:', { success, sent, failed, total_subscriptions, results });
      
      // Determine success based on actual results
      const actualSuccess = (sent && sent > 0) || (results && results.success > 0);
      const totalSubs = total_subscriptions || (results && results.total) || 0;
      const successCount = sent || (results && results.success) || 0;
      const failureCount = failed || (results && results.failures) || 0;
      
      let message;
      let isSuccess = false;
      
      if (totalSubs === 0) {
        message = '⚠️ Keine aktiven Push-Abonnements gefunden. Bitte registrieren Sie sich zuerst für Push-Notifications.';
        isSuccess = false;
      } else if (actualSuccess) {
        message = `✅ Test erfolgreich! ${successCount} Benachrichtigung(en) gesendet von ${totalSubs} Abonnement(s).`;
        isSuccess = true;
      } else {
        message = `⚠️ Test abgeschlossen, aber keine Benachrichtigungen erfolgreich gesendet. ${failureCount} von ${totalSubs} fehlgeschlagen.`;
        isSuccess = false;
      }
      
      setTestResult({ 
        step: 'Test-Benachrichtigung senden', 
        status: isSuccess ? 'success' : 'error',
        message
      });

      toast({
        title: isSuccess ? "Push-Test erfolgreich!" : "Push-Test mit Problemen",
        description: isSuccess ? "Das Push-Notification System funktioniert korrekt." : message,
        variant: isSuccess ? "default" : "destructive",
      });

    } catch (error) {
      console.error('Push test error:', error);
      setTestResult({ 
        step: 'Fehler', 
        status: 'error',
        message: `❌ Unerwarteter Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });

      toast({
        title: "Push-Test fehlgeschlagen",
        description: `Unerwarteter Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: "destructive",
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
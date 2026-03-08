import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export const PushNotificationTest: React.FC = () => {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [realTestResult, setRealTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isRealTestRunning, setIsRealTestRunning] = useState(false);
  const { pushSupported, pushPermission, requestPushPermission, subscribeToPush } = useNotifications();
  const { toast } = useToast();

  const runRealPushTest = async () => {
    debugConsole.log('=== ECHTER PUSH TEST GESTARTET ===');
    debugConsole.log('🔧 Testing with updated VAPID keys and full system...');
    setIsRealTestRunning(true);
    
    try {
      setRealTestResult({ step: 'Starte echten Push-Test mit neuen VAPID-Keys...', status: 'pending', message: 'VAPID-Konfiguration wird getestet...' });

      if (!pushSupported) {
        setRealTestResult({ step: 'Browser-Support fehlt', status: 'error', message: '❌ Browser unterstützt keine Push-Notifications' });
        return;
      }

      if (pushPermission !== 'granted') {
        setRealTestResult({ step: 'Berechtigung fehlt', status: 'error', message: '❌ Push-Berechtigung nicht erteilt. Bitte erst den normalen Test durchführen.' });
        return;
      }

      setRealTestResult({ step: 'Subscription prüfen', status: 'pending', message: 'Prüfe Push-Subscription...' });
      
      try {
        await subscribeToPush();
        setRealTestResult({ step: 'Subscription bereit', status: 'success', message: '✅ Push-Subscription ist bereit' });
      } catch (error) {
        debugConsole.error('❌ Subscription error:', error);
        setRealTestResult({ step: 'Subscription Fehler', status: 'error', message: `❌ Fehler bei Subscription: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` });
        return;
      }

      setRealTestResult({ step: 'Echte Push-Notification senden', status: 'pending', message: 'Sende echte Browser-Push-Notification...' });

      debugConsole.log('🚀 Invoking REAL push notification...');
      
      const response = await supabase.functions.invoke('send-push-notification', {
        body: { 
          title: 'Echte Push-Notification! 🔔',
          message: 'Dies ist eine echte Browser-Push-Notification!',
          priority: 'high',
          data: { real_push: true, test_timestamp: new Date().toISOString() }
        }
      });

      debugConsole.log('📤 Real Push Edge Function response:', response);

      if (response.error) {
        debugConsole.error('❌ Real Push Edge Function error:', response.error);
        setRealTestResult({ step: 'Echte Push-Notification senden', status: 'error', message: `❌ Edge Function Fehler: ${response.error.message || 'Unbekannter Fehler'}` });
        return;
      }

      const responseData = response.data;
      debugConsole.log('📊 Real Push Response data:', responseData);
      
      if (responseData && responseData.sent > 0) {
        setRealTestResult({ step: 'Echter Test erfolgreich!', status: 'success', message: `✅ ${responseData.sent} echte Push-Notification(en) erfolgreich gesendet! Schau in deine Browser-Benachrichtigungen.` });
        toast({ title: 'Echter Push-Test erfolgreich!', description: 'Du solltest jetzt eine echte Browser-Push-Notification sehen.' });
      } else if (responseData && responseData.message && responseData.message.includes('noch in Entwicklung')) {
        setRealTestResult({ step: 'Echte Push-Notifications in Entwicklung', status: 'pending', message: `ℹ️ ${responseData.message}` });
        toast({ title: 'Feature in Entwicklung', description: 'Echte Browser-Push-Notifications werden gerade implementiert.', variant: 'default' });
      } else {
        setRealTestResult({ step: 'Echter Test fehlgeschlagen', status: 'error', message: `⚠️ Keine echten Benachrichtigungen erfolgreich gesendet. ${responseData?.failed || 'Unbekannt'} von ${responseData?.total_subscriptions || 'unbekannt'} fehlgeschlagen.` });
        toast({ title: 'Echter Push-Test fehlgeschlagen', description: 'Echte Push-Notifications konnten nicht gesendet werden.', variant: 'destructive' });
      }

    } catch (error) {
      debugConsole.error('❌ Real push test error:', error);
      setRealTestResult({ step: 'Echter Test fehlgeschlagen', status: 'error', message: error instanceof Error ? error.message : 'Unbekannter Fehler beim echten Push-Test' });
      toast({ title: 'Echter Push-Test fehlgeschlagen', description: 'Es ist ein unerwarteter Fehler beim echten Push-Test aufgetreten.', variant: 'destructive' });
    } finally {
      setIsRealTestRunning(false);
    }
    
    debugConsole.log('=== ECHTER PUSH TEST BEENDET ===');
  };

  const runPushTest = async () => {
    debugConsole.log('=== PUSH TEST GESTARTET ===');
    setIsRunning(true);
    
    try {
      setTestResult({ step: 'Starte Push-Test...', status: 'pending', message: '' });

      debugConsole.log('Step 1: Browser Support Check');
      debugConsole.log('pushSupported:', pushSupported);
      
      setTestResult({ step: 'Browser-Support prüfen', status: pushSupported ? 'success' : 'error', message: pushSupported ? '✅ Push-Notifications werden unterstützt' : '❌ Browser unterstützt keine Push-Notifications' });

      if (!pushSupported) {
        debugConsole.log('❌ Test beendet: Browser-Support fehlt');
        return;
      }

      debugConsole.log('Step 2: Permission Check');
      debugConsole.log('Current pushPermission:', pushPermission);
      
      if (pushPermission !== 'granted') {
        setTestResult({ step: 'Berechtigung anfordern', status: 'pending', message: 'Fordere Push-Berechtigung an...' });
        
        try {
          debugConsole.log('Requesting push permission...');
          const permission = await requestPushPermission();
          debugConsole.log('Permission result:', permission);
          
          setTestResult({ step: 'Berechtigung anfordern', status: permission ? 'success' : 'error', message: permission ? '✅ Berechtigung erfolgreich erteilt' : '❌ Berechtigung verweigert' });

          if (!permission) {
            debugConsole.log('❌ Test beendet: Berechtigung verweigert');
            return;
          }
        } catch (error) {
          debugConsole.error('❌ Permission error:', error);
          setTestResult({ step: 'Berechtigung anfordern', status: 'error', message: `❌ Fehler beim Anfordern der Berechtigung: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` });
          return;
        }
      } else {
        debugConsole.log('✅ Permission already granted');
        setTestResult({ step: 'Berechtigung prüfen', status: 'success', message: '✅ Push-Berechtigung bereits erteilt' });
      }

      debugConsole.log('Step 3: Push Subscription');
      setTestResult({ step: 'Push-Subscription erstellen', status: 'pending', message: 'Erstelle Subscription...' });
      
      try {
        debugConsole.log('Calling subscribeToPush...');
        await subscribeToPush();
        debugConsole.log('✅ subscribeToPush completed successfully');
        
        setTestResult({ step: 'Push-Subscription erstellen', status: 'success', message: '✅ Subscription erfolgreich erstellt' });
      } catch (error) {
        debugConsole.error('❌ Push subscription error:', error);
        setTestResult({ step: 'Push-Subscription erstellen', status: 'error', message: `❌ Fehler beim Erstellen der Subscription: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` });
        return;
      }

      debugConsole.log('Step 4: Database Verification');
      setTestResult({ step: 'Subscription in Datenbank prüfen', status: 'pending', message: 'Prüfe Datenbank...' });
      
      try {
        const { data: subscriptions, error } = await supabase
          .from('push_subscriptions')
          .select('id, user_id, is_active')
          .eq('is_active', true);
          
        debugConsole.log('Database subscriptions:', subscriptions);
        debugConsole.log('Database error:', error);
        
        if (error) throw error;
        
        if (!subscriptions || subscriptions.length === 0) {
          setTestResult({ step: 'Subscription in Datenbank prüfen', status: 'error', message: '❌ Keine aktive Subscription in der Datenbank gefunden' });
          return;
        }
        
        setTestResult({ step: 'Subscription in Datenbank prüfen', status: 'success', message: `✅ ${subscriptions.length} aktive Subscription(s) in der Datenbank` });
      } catch (error) {
        debugConsole.error('❌ Database check error:', error);
        setTestResult({ step: 'Subscription in Datenbank prüfen', status: 'error', message: `❌ Datenbankfehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` });
        return;
      }

      debugConsole.log('Step 5: Send Test Notification');
      setTestResult({ step: 'Test-Benachrichtigung senden', status: 'pending', message: 'Sende Test-Benachrichtigung...' });

      debugConsole.log('🚀 Invoking push notification test...');
      
      const response = await supabase.functions.invoke('send-push-notification', {
        body: { type: 'test', title: 'Push-Test erfolgreich! 🎉', message: 'Das Push-Notification System funktioniert korrekt.', priority: 'high' }
      });

      debugConsole.log('📤 Edge Function response:', response);

      if (response.error) {
        debugConsole.error('❌ Edge Function error:', response.error);
        setTestResult({ step: 'Test-Benachrichtigung senden', status: 'error', message: `❌ Edge Function Fehler: ${response.error.message || 'Unbekannter Fehler'}` });
        return;
      }

      const responseData = response.data;
      debugConsole.log('📊 Response data:', responseData);
      
      if (responseData && responseData.sent > 0) {
        setTestResult({ step: 'Test abgeschlossen!', status: 'success', message: `✅ ${responseData.sent} Benachrichtigung(en) erfolgreich gesendet!` });
        toast({ title: 'Test erfolgreich!', description: 'Push-Benachrichtigungen funktionieren korrekt.' });
      } else {
        setTestResult({ step: 'Test abgeschlossen', status: 'error', message: `⚠️ Test abgeschlossen, aber keine Benachrichtigungen erfolgreich gesendet. ${responseData?.failed || 'Unbekannt'} von ${responseData?.total_subscriptions || 'unbekannt'} fehlgeschlagen.` });
        toast({ title: 'Test teilweise erfolgreich', description: 'Test durchgeführt, aber Benachrichtigungen konnten nicht gesendet werden.', variant: 'destructive' });
      }

    } catch (error) {
      debugConsole.error('❌ Overall test error:', error);
      setTestResult({ step: 'Test fehlgeschlagen', status: 'error', message: error instanceof Error ? error.message : 'Unbekannter Fehler beim Push-Test' });
      toast({ title: 'Test fehlgeschlagen', description: 'Es ist ein unerwarteter Fehler beim Push-Test aufgetreten.', variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
    
    debugConsole.log('=== PUSH TEST BEENDET ===');
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Push-Notification Test
        </CardTitle>
        <CardDescription>
          Teste das Push-Notification System
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 text-sm">
          <span>Browser-Support:</span>
          <Badge variant={pushSupported ? "default" : "destructive"}>
            {pushSupported ? "Unterstützt" : "Nicht unterstützt"}
          </Badge>
        </div>
        
        <div className="flex gap-2 text-sm">
          <span>Berechtigung:</span>
          <Badge variant={pushPermission === 'granted' ? "default" : pushPermission === 'denied' ? "destructive" : "secondary"}>
            {pushPermission === 'granted' ? "Erteilt" : 
             pushPermission === 'denied' ? "Verweigert" : "Ausstehend"}
          </Badge>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg border ${getStatusColor(testResult.status)}`}>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(testResult.status)}
              <span className="font-medium">{testResult.step}</span>
            </div>
            {testResult.message && (
              <p className="text-sm">{testResult.message}</p>
            )}
          </div>
        )}

        {realTestResult && (
          <div className={`p-3 rounded-lg border ${getStatusColor(realTestResult.status)}`}>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(realTestResult.status)}
              <span className="font-medium font-bold">🔔 {realTestResult.step}</span>
            </div>
            {realTestResult.message && (
              <p className="text-sm font-medium">{realTestResult.message}</p>
            )}
          </div>
        )}

        <Button 
          onClick={runPushTest} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Test läuft...' : 'Push-Test starten (Datenbank)'}
        </Button>

        <Button 
          onClick={runRealPushTest} 
          disabled={isRealTestRunning || pushPermission !== 'granted'}
          className="w-full"
          variant="outline"
        >
          {isRealTestRunning ? 'Echter Test läuft...' : '🔔 Echte Browser-Push-Notification testen'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Der erste Test prüft die Grundfunktionalität und erstellt Datenbank-Benachrichtigungen.
          Der zweite Test sendet echte Browser-Push-Notifications.
          Öffne die Browser-Konsole (F12) für detaillierte Debug-Informationen.
        </p>
      </CardContent>
    </Card>
  );
};

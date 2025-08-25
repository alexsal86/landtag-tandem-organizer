import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export const PushNotificationTest: React.FC = () => {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { pushSupported, pushPermission, requestPushPermission, subscribeToPush } = useNotifications();
  const { toast } = useToast();

  const runPushTest = async () => {
    console.log('=== PUSH TEST GESTARTET ===');
    setIsRunning(true);
    
    try {
      setTestResult({ step: 'Starte Push-Test...', status: 'pending', message: '' });

      // Step 1: Check browser support
      console.log('Step 1: Browser Support Check');
      console.log('pushSupported:', pushSupported);
      
      setTestResult({ 
        step: 'Browser-Support prüfen', 
        status: pushSupported ? 'success' : 'error',
        message: pushSupported ? '✅ Push-Notifications werden unterstützt' : '❌ Browser unterstützt keine Push-Notifications'
      });

      if (!pushSupported) {
        console.log('❌ Test beendet: Browser-Support fehlt');
        return;
      }

      // Step 2: Check permission
      console.log('Step 2: Permission Check');
      console.log('Current pushPermission:', pushPermission);
      
      if (pushPermission !== 'granted') {
        setTestResult({ step: 'Berechtigung anfordern', status: 'pending', message: 'Fordere Push-Berechtigung an...' });
        
        try {
          console.log('Requesting push permission...');
          const permission = await requestPushPermission();
          console.log('Permission result:', permission);
          
          setTestResult({ 
            step: 'Berechtigung anfordern', 
            status: permission ? 'success' : 'error',
            message: permission ? '✅ Berechtigung erfolgreich erteilt' : '❌ Berechtigung verweigert'
          });

          if (!permission) {
            console.log('❌ Test beendet: Berechtigung verweigert');
            return;
          }
        } catch (error) {
          console.error('❌ Permission error:', error);
          setTestResult({ 
            step: 'Berechtigung anfordern', 
            status: 'error',
            message: `❌ Fehler beim Anfordern der Berechtigung: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
          });
          return;
        }
      } else {
        console.log('✅ Permission already granted');
        setTestResult({ 
          step: 'Berechtigung prüfen', 
          status: 'success',
          message: '✅ Push-Berechtigung bereits erteilt'
        });
      }

      // Step 3: Create/verify subscription
      console.log('Step 3: Push Subscription');
      setTestResult({ step: 'Push-Subscription erstellen', status: 'pending', message: 'Erstelle Subscription...' });
      
      try {
        console.log('Calling subscribeToPush...');
        await subscribeToPush();
        console.log('✅ subscribeToPush completed successfully');
        
        setTestResult({ 
          step: 'Push-Subscription erstellen', 
          status: 'success',
          message: '✅ Subscription erfolgreich erstellt'
        });
      } catch (error) {
        console.error('❌ Push subscription error:', error);
        setTestResult({ 
          step: 'Push-Subscription erstellen', 
          status: 'error',
          message: `❌ Fehler beim Erstellen der Subscription: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
        });
        return;
      }

      // Step 4: Verify subscription in database
      console.log('Step 4: Database Verification');
      setTestResult({ step: 'Subscription in Datenbank prüfen', status: 'pending', message: 'Prüfe Datenbank...' });
      
      try {
        const { data: subscriptions, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('is_active', true);
          
        console.log('Database subscriptions:', subscriptions);
        console.log('Database error:', error);
        
        if (error) throw error;
        
        if (!subscriptions || subscriptions.length === 0) {
          setTestResult({ 
            step: 'Subscription in Datenbank prüfen', 
            status: 'error',
            message: '❌ Keine aktive Subscription in der Datenbank gefunden'
          });
          return;
        }
        
        setTestResult({ 
          step: 'Subscription in Datenbank prüfen', 
          status: 'success',
          message: `✅ ${subscriptions.length} aktive Subscription(s) in der Datenbank`
        });
      } catch (error) {
        console.error('❌ Database check error:', error);
        setTestResult({ 
          step: 'Subscription in Datenbank prüfen', 
          status: 'error',
          message: `❌ Datenbankfehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
        });
        return;
      }

      // Step 5: Test notification
      console.log('Step 5: Send Test Notification');
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
        setTestResult({
          step: 'Test-Benachrichtigung senden',
          status: 'error',
          message: `❌ Edge Function Fehler: ${response.error.message || 'Unbekannter Fehler'}`
        });
        return;
      }

      const responseData = response.data;
      console.log('📊 Response data:', responseData);
      
      if (responseData && responseData.sent > 0) {
        setTestResult({
          step: 'Test abgeschlossen!',
          status: 'success',
          message: `✅ ${responseData.sent} Benachrichtigung(en) erfolgreich gesendet!`
        });
        
        toast({
          title: 'Test erfolgreich!',
          description: 'Push-Benachrichtigungen funktionieren korrekt.',
        });
      } else {
        setTestResult({
          step: 'Test abgeschlossen',
          status: 'error',
          message: `⚠️ Test abgeschlossen, aber keine Benachrichtigungen erfolgreich gesendet. ${responseData?.failed || 'Unbekannt'} von ${responseData?.total_subscriptions || 'unbekannt'} fehlgeschlagen.`
        });
        
        toast({
          title: 'Test teilweise erfolgreich',
          description: 'Test durchgeführt, aber Benachrichtigungen konnten nicht gesendet werden.',
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('❌ Overall test error:', error);
      setTestResult({
        step: 'Test fehlgeschlagen',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler beim Push-Test',
      });

      toast({
        title: 'Test fehlgeschlagen',
        description: 'Es ist ein unerwarteter Fehler beim Push-Test aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
    
    console.log('=== PUSH TEST BEENDET ===');
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

        <Button 
          onClick={runPushTest} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Test läuft...' : 'Push-Test starten'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Dieser Test prüft die vollständige Push-Notification Funktionalität.
          Öffne die Browser-Konsole (F12) für detaillierte Debug-Informationen.
        </p>
      </CardContent>
    </Card>
  );
};
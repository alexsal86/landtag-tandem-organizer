import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';

interface DirectTestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  logs?: string[];
}

export const DirectPushTest: React.FC = () => {
  const [testResult, setTestResult] = useState<DirectTestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDirectPushTest = async () => {
    debugConsole.log('🔥 === DIREKTER PUSH TEST GESTARTET ===');
    setIsRunning(true);
    
    try {
      setTestResult({
        step: 'Direkter Push-Test',
        status: 'pending',
        message: 'Sende direkte Browser-Push-Notification...',
        logs: ['🔥 Direkter Test gestartet']
      });

      debugConsole.log('🚀 Calling send-push-notification Edge Function directly...');
      
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('id, user_id, is_active')
        .eq('is_active', true);
        
      debugConsole.log('📋 Current active subscriptions:', subscriptions);
      
      if (subError) {
        debugConsole.error('❌ Subscription check error:', subError);
      }
      
      if (!subscriptions || subscriptions.length === 0) {
        setTestResult({
          step: 'Direkter Push-Test',
          status: 'error',
          message: '❌ Keine aktiven Push-Subscriptions gefunden. Aktiviere zuerst Browser-Benachrichtigungen!',
          logs: ['❌ Keine Push-Subscriptions in der Datenbank']
        });
        return;
      }
      
      const response = await supabase.functions.invoke('send-push-notification', {
        body: { 
          title: 'Direkter Push-Test! 🔥🔔',
          message: 'Dies ist ein direkter Browser-Push-Test mit erweiterten Logs!',
          priority: 'high',
          data: {
            direct_test: true,
            timestamp: new Date().toISOString(),
            test_id: `test_${Date.now()}`
          }
        }
      });

      debugConsole.log('📤 Direct Push Edge Function response:', response);

      const logs = [
        '🔥 Direkter Test gestartet',
        `📡 Response Status: ${response.error ? 'ERROR' : 'SUCCESS'}`,
        `📊 Response: ${JSON.stringify(response, null, 2)}`
      ];

      if (response.error) {
        debugConsole.error('❌ Direct Push Edge Function error:', response.error);
        setTestResult({
          step: 'Direkter Push-Test',
          status: 'error',
          message: `❌ Edge Function Fehler: ${response.error.message || 'Unbekannter Fehler'}`,
          logs: [...logs, `❌ Error: ${response.error.message}`]
        });
        return;
      }

      const responseData = response.data;
      debugConsole.log('📊 Direct Push Response data:', responseData);
      
      logs.push(`📊 Data: ${JSON.stringify(responseData, null, 2)}`);

      if (responseData && responseData.sent > 0) {
        setTestResult({
          step: 'Direkter Push-Test erfolgreich!',
          status: 'success',
          message: `✅ ${responseData.sent} echte Browser-Push-Notification(en) gesendet! Prüfe deine Browser-Benachrichtigungen!`,
          logs: [...logs, `✅ ${responseData.sent} Push-Notifications erfolgreich gesendet!`]
        });
      } else {
        setTestResult({
          step: 'Push-Test abgeschlossen',
          status: 'error',
          message: `⚠️ Keine Pushes erfolgreich gesendet. ${responseData?.failed || 0} fehlgeschlagen von ${responseData?.total_subscriptions || 0} total.`,
          logs: [...logs, `⚠️ Keine erfolgreichen Pushes: ${responseData?.message || 'Unbekannter Grund'}`]
        });
      }

    } catch (error) {
      debugConsole.error('❌ Direct push test error:', error);
      setTestResult({
        step: 'Direkter Push-Test fehlgeschlagen',
        status: 'error',
        message: `❌ Unerwarteter Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        logs: [`❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`]
      });
    } finally {
      setIsRunning(false);
    }

    debugConsole.log('🔥 === DIREKTER PUSH TEST BEENDET ===');
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
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Direkter Push-Test
        </CardTitle>
        <CardDescription>
          Direkter Test mit detaillierten Logs für echte Browser-Push-Notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {testResult && (
          <div className={`p-4 rounded-lg border ${getStatusColor(testResult.status)}`}>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(testResult.status)}
              <span className="font-medium">{testResult.step}</span>
            </div>
            <p className="text-sm mb-2">{testResult.message}</p>
            
            {testResult.logs && testResult.logs.length > 0 && (
              <div className="mt-3 p-2 bg-gray-100 rounded text-xs font-mono max-h-48 overflow-y-auto">
                <details open={testResult.status === 'error'}>
                  <summary className="cursor-pointer font-semibold">Detaillierte Logs</summary>
                  <div className="mt-2 space-y-1">
                    {testResult.logs.map((log, index) => (
                      <div key={index} className="border-l-2 border-gray-300 pl-2">
                        {log}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={runDirectPushTest} 
          disabled={isRunning}
          className="w-full"
          variant="default"
          size="lg"
        >
          {isRunning ? 'Teste direkten Push...' : '🔥 Direkter Browser-Push-Test'}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold">Was dieser Test macht:</p>
          <p>• Ruft die Edge Function direkt auf</p>
          <p>• Zeigt detaillierte Response-Logs</p>
          <p>• Sendet echte Browser-Push-Notifications</p>
          <p>• Prüfe deine Browser-Benachrichtigungen!</p>
        </div>
      </CardContent>
    </Card>
  );
};

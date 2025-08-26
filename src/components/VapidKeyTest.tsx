import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Key } from 'lucide-react';

interface VapidTestResult {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  data?: any;
}

export const VapidKeyTest: React.FC = () => {
  const [testResult, setTestResult] = useState<VapidTestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const testVapidConfiguration = async () => {
    console.log('🔑 === VAPID KEY TEST GESTARTET ===');
    setIsRunning(true);
    
    try {
      setTestResult({
        step: 'VAPID-Konfiguration testen',
        status: 'pending',
        message: 'Prüfe VAPID-Schlüssel Konfiguration...'
      });

      // Test GET endpoint for VAPID public key
      console.log('🔗 Teste GET-Endpoint für VAPID Public Key...');
      const response = await fetch(`https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50',
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        setTestResult({
          step: 'Edge Function Fehler',
          status: 'error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          data: { status: response.status }
        });
        return;
      }

      const data = await response.json();
      console.log('📊 Response data:', data);

      if (data.success && data.publicKey) {
        // Validate the public key format
        const publicKey = data.publicKey;
        const isValidFormat = publicKey && 
                            typeof publicKey === 'string' && 
                            publicKey.length > 60 && // VAPID keys are typically 87+ characters
                            publicKey.startsWith('B'); // VAPID keys typically start with 'B'

        console.log('🔑 Public key validation:', {
          length: publicKey.length,
          startsWithB: publicKey.startsWith('B'),
          isValid: isValidFormat
        });

        if (isValidFormat) {
          setTestResult({
            step: 'VAPID-Konfiguration erfolgreich',
            status: 'success',
            message: `✅ VAPID Public Key erhalten! Länge: ${publicKey.length} Zeichen`,
            data: {
              publicKey: publicKey.substring(0, 20) + '...', // Nur die ersten 20 Zeichen anzeigen
              fullLength: publicKey.length,
              format: 'valid'
            }
          });
        } else {
          setTestResult({
            step: 'VAPID-Format ungültig',
            status: 'error',
            message: `❌ VAPID Public Key hat ungültiges Format. Länge: ${publicKey.length}`,
            data: { publicKey: publicKey.substring(0, 20) + '...' }
          });
        }
      } else {
        setTestResult({
          step: 'VAPID-Response ungültig',
          status: 'error',
          message: `❌ Ungültige Antwort: ${data.error || 'Kein Public Key erhalten'}`,
          data
        });
      }

    } catch (error) {
      console.error('❌ VAPID test error:', error);
      setTestResult({
        step: 'VAPID-Test fehlgeschlagen',
        status: 'error',
        message: `❌ Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsRunning(false);
    }

    console.log('🔑 === VAPID KEY TEST BEENDET ===');
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
          <Key className="h-5 w-5" />
          VAPID-Schlüssel Test
        </CardTitle>
        <CardDescription>
          Teste die VAPID-Konfiguration für Push-Notifications
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
            
            {testResult.data && (
              <div className="mt-3 p-2 bg-gray-100 rounded text-xs font-mono">
                <details>
                  <summary className="cursor-pointer font-semibold">Debug-Details</summary>
                  <pre className="mt-2 overflow-x-auto">
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={testVapidConfiguration} 
          disabled={isRunning}
          className="w-full"
          variant="outline"
        >
          {isRunning ? 'Teste VAPID-Keys...' : '🔑 VAPID-Konfiguration testen'}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Dieser Test prüft, ob die VAPID-Schlüssel korrekt konfiguriert sind</p>
          <p>• VAPID Public Key sollte ≥87 Zeichen haben und mit 'B' beginnen</p>
          <p>• Edge Function muss die drei Secrets haben: PUBLIC_KEY, PRIVATE_KEY, SUBJECT</p>
        </div>
      </CardContent>
    </Card>
  );
};
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function DecisionResponse() {
  const { participantId } = useParams<{ participantId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const initialResponse = searchParams.get('response') as 'yes' | 'no' | 'question' | null;

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [responseType, setResponseType] = useState<'yes' | 'no' | 'question' | null>(initialResponse);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (initialResponse && token && participantId) {
      // Auto-submit for yes/no responses
      if (initialResponse === 'yes' || initialResponse === 'no') {
        handleSubmit(initialResponse);
      }
    }
  }, [initialResponse, token, participantId]);

  const handleSubmit = async (type: 'yes' | 'no' | 'question' = responseType!) => {
    if (!token || !participantId) {
      setError("Ungültiger Link");
      return;
    }

    if (type === 'question' && !comment.trim()) {
      setError("Bitte geben Sie eine Frage oder einen Kommentar ein.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('process-decision-response', {
        body: {
          participantId,
          token,
          responseType: type,
          comment: comment.trim() || undefined,
        },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      setResult(data);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting response:', err);
      setError(err.message || "Fehler beim Speichern der Antwort");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-xl">Antwort gespeichert</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Vielen Dank, {result.participantName}!
            </p>
            <p className="text-sm">
              Ihre Antwort zu "{result.decisionTitle}" wurde erfolgreich gespeichert.
            </p>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                Ihre Antwort: 
                <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                  result.responseType === 'yes' ? 'bg-green-100 text-green-800' :
                  result.responseType === 'no' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {result.responseType === 'yes' ? '✓ Ja' :
                   result.responseType === 'no' ? '✗ Nein' :
                   '? Frage'}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !participantId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-xl">Ungültiger Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Dieser Link ist ungültig oder abgelaufen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Entscheidungsanfrage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bitte wählen Sie Ihre Antwort
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {responseType === 'question' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Ihre Frage oder Kommentar:</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Bitte beschreiben Sie Ihre Frage oder Anmerkung..."
                  rows={4}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setResponseType(null)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Zurück
                </Button>
                <Button
                  onClick={() => handleSubmit('question')}
                  disabled={isLoading || !comment.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Frage senden"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Kommentar (optional):</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optionaler Kommentar zu Ihrer Antwort..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              
              <div className="grid gap-3">
                <Button
                  onClick={() => handleSubmit('yes')}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white py-3"
                >
                  {isLoading && responseType === 'yes' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Ja, einverstanden
                </Button>
                
                <Button
                  onClick={() => setResponseType('question')}
                  disabled={isLoading}
                  variant="outline"
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 py-3"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Frage stellen
                </Button>
                
                <Button
                  onClick={() => handleSubmit('no')}
                  disabled={isLoading}
                  variant="destructive"
                  className="py-3"
                >
                  {isLoading && responseType === 'no' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Nein, nicht einverstanden
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
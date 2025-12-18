import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Check, X, MessageCircle, Circle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { ResponseOption, getColorClasses, getDefaultOptions } from "@/lib/decisionTemplates";

const getIcon = (iconName?: string, className = "h-4 w-4") => {
  switch (iconName) {
    case "check":
      return <Check className={className} />;
    case "x":
      return <X className={className} />;
    case "message-circle":
      return <MessageCircle className={className} />;
    case "star":
      return <Star className={className} />;
    default:
      return <Circle className={className} />;
  }
};

export default function DecisionResponse() {
  const { participantId } = useParams<{ participantId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const initialResponse = searchParams.get('response');

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selectedOption, setSelectedOption] = useState<ResponseOption | null>(null);
  const [result, setResult] = useState<any>(null);
  const [responseOptions, setResponseOptions] = useState<ResponseOption[]>(getDefaultOptions());

  useEffect(() => {
    if (token && participantId) {
      loadDecisionOptions();
    }
  }, [token, participantId]);

  useEffect(() => {
    if (!isLoadingOptions && initialResponse && token && participantId) {
      const option = responseOptions.find(o => o.key === initialResponse);
      if (option && !option.requires_comment) {
        handleSubmit(option);
      }
    }
  }, [isLoadingOptions, initialResponse, token, participantId, responseOptions]);

  const loadDecisionOptions = async () => {
    try {
      // First get the decision_id from participant
      const { data: participant, error: participantError } = await supabase
        .from('task_decision_participants')
        .select('decision_id')
        .eq('id', participantId)
        .eq('token', token)
        .single();

      if (participantError || !participant) {
        console.error('Error loading participant:', participantError);
        setIsLoadingOptions(false);
        return;
      }

      // Then get the response options
      const { data, error } = await supabase
        .from('task_decisions')
        .select('response_options')
        .eq('id', participant.decision_id)
        .single();

      if (error) throw error;
      if (data?.response_options && Array.isArray(data.response_options)) {
        setResponseOptions(data.response_options as unknown as ResponseOption[]);
      }
    } catch (error) {
      console.error('Error loading decision options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const handleSubmit = async (option: ResponseOption) => {
    if (!token || !participantId) {
      setError("Ungültiger Link");
      return;
    }

    if (option.requires_comment && !comment.trim()) {
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
          responseType: option.key,
          comment: comment.trim() || undefined,
        },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      setResult({ ...data, selectedOption: option });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting response:', err);
      setError(err.message || "Fehler beim Speichern der Antwort");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!token || !participantId || !comment.trim() || !result?.selectedOption) return;

    setIsLoading(true);
    try {
      const { error: functionError } = await supabase.functions.invoke('process-decision-response', {
        body: {
          participantId,
          token,
          responseType: result.selectedOption.key,
          comment: comment.trim(),
        },
      });

      if (functionError) throw new Error(functionError.message);

      setResult({ ...result, commentAdded: true });
      setComment("");
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err.message || "Fehler beim Speichern des Kommentars");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted && result) {
    const option = result.selectedOption;
    const colorClasses = option ? getColorClasses(option.color) : getColorClasses("gray");

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-xl">Antwort gespeichert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground">
                Vielen Dank, {result.participantName}!
              </p>
              <p className="text-sm">
                Ihre Antwort zu "{result.decisionTitle}" wurde erfolgreich gespeichert.
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-sm font-medium flex items-center justify-center gap-2">
                Ihre Antwort: 
                <Badge variant="outline" className={`${colorClasses.textClass} ${colorClasses.borderClass}`}>
                  {option?.icon && getIcon(option.icon, "h-3 w-3")}
                  <span className="ml-1">{option?.label || result.responseType}</span>
                </Badge>
              </p>
            </div>

            {/* Comment section after submission */}
            {!result.commentAdded && !option?.requires_comment && (
              <div className="border-t pt-4 space-y-3">
                <label className="text-sm font-medium">Möchten Sie einen Kommentar hinzufügen?</label>
                <SimpleRichTextEditor
                  initialContent={comment}
                  onChange={setComment}
                  placeholder="Optionaler Kommentar zu Ihrer Antwort..."
                  minHeight="80px"
                />
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <Button
                  onClick={handleAddComment}
                  disabled={isLoading || !comment.trim()}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Kommentar hinzufügen
                </Button>
              </div>
            )}

            {result.commentAdded && (
              <div className="border-t pt-4 text-center">
                <p className="text-sm text-green-600">✓ Kommentar wurde hinzugefügt</p>
              </div>
            )}
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

  if (isLoadingOptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-2">Lade Entscheidungsoptionen...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if any option requires comment for special handling
  const optionRequiringComment = responseOptions.find(o => o.requires_comment);

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

          {selectedOption?.requires_comment ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Ihre Frage oder Kommentar:</label>
                <div className="mt-1">
                  <SimpleRichTextEditor
                    initialContent={comment}
                    onChange={setComment}
                    placeholder="Bitte beschreiben Sie Ihre Frage oder Anmerkung..."
                    minHeight="100px"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedOption(null)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Zurück
                </Button>
                <Button
                  onClick={() => handleSubmit(selectedOption)}
                  disabled={isLoading || !comment.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Senden"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Kommentar (optional):</label>
                <div className="mt-1">
                  <SimpleRichTextEditor
                    initialContent={comment}
                    onChange={setComment}
                    placeholder="Optionaler Kommentar zu Ihrer Antwort..."
                    minHeight="80px"
                  />
                </div>
              </div>
              
              <div className="grid gap-3">
                {responseOptions.map((option) => {
                  const colorClasses = getColorClasses(option.color);
                  
                  if (option.requires_comment) {
                    return (
                      <Button
                        key={option.key}
                        onClick={() => setSelectedOption(option)}
                        disabled={isLoading}
                        variant="outline"
                        className={`py-3 ${colorClasses.textClass} ${colorClasses.borderClass}`}
                      >
                        {getIcon(option.icon)}
                        <span className="ml-2">{option.label}</span>
                      </Button>
                    );
                  }

                  return (
                    <Button
                      key={option.key}
                      onClick={() => handleSubmit(option)}
                      disabled={isLoading}
                      className={`py-3 ${colorClasses.bgClass} ${colorClasses.textClass} hover:opacity-90`}
                      variant="outline"
                    >
                      {isLoading && selectedOption?.key === option.key ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        getIcon(option.icon)
                      )}
                      <span className="ml-2">{option.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

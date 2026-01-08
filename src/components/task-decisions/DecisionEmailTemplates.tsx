import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RefreshCw, Copy, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmailTemplate {
  id: string;
  tenant_id: string;
  subject: string;
  greeting: string;
  introduction: string;
  instruction: string;
  question_prompt: string;
  closing: string;
  signature: string;
}

export const DecisionEmailTemplates = () => {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('decision_email_templates')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTemplate(data);
      } else {
        // Create default template if none exists
        await createDefaultTemplate();
      }
    } catch (error) {
      console.error('Error loading email template:', error);
      toast({
        title: "Fehler",
        description: "E-Mail-Template konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultTemplate = async () => {
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userProfile?.tenant_id) return;

      const { data, error } = await supabase
        .from('decision_email_templates')
        .insert({
          tenant_id: userProfile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      setTemplate(data);
    } catch (error) {
      console.error('Error creating default template:', error);
    }
  };

  const saveTemplate = async () => {
    if (!template) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('decision_email_templates')
        .update({
          subject: template.subject,
          greeting: template.greeting,
          introduction: template.introduction,
          instruction: template.instruction,
          question_prompt: template.question_prompt,
          closing: template.closing,
          signature: template.signature,
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Gespeichert",
        description: "E-Mail-Template wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Fehler",
        description: "E-Mail-Template konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof EmailTemplate, value: string) => {
    if (template) {
      setTemplate({ ...template, [field]: value });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>E-Mail-Template wird geladen...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-20 bg-muted rounded animate-pulse" />
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>E-Mail-Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Kein E-Mail-Template gefunden. 
            <Button variant="link" onClick={loadTemplate} className="p-0 h-auto ml-1">
              <RefreshCw className="h-4 w-4 mr-1" />
              Erneut versuchen
            </Button>
          </p>
        </CardContent>
      </Card>
    );
  }

  const availableVariables = [
    { name: '{participant_name}', description: 'Name des Empfängers' },
    { name: '{creator_name}', description: 'Name des Erstellers' },
    { name: '{decision_title}', description: 'Titel der Entscheidung' },
    { name: '{task_title}', description: 'Titel der Aufgabe' },
    { name: '{decision_description}', description: 'Beschreibung (optional)' },
  ];

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast({
      title: "Kopiert",
      description: `${variable} wurde in die Zwischenablage kopiert.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-Mail-Template für Entscheidungsanfragen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Passen Sie die Texte für E-Mail-Benachrichtigungen an.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variables Box */}
        <div className="bg-muted/50 rounded-lg p-4 border">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Verfügbare Variablen</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((v) => (
              <Badge
                key={v.name}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => copyVariable(v.name)}
                title={v.description}
              >
                <Copy className="h-3 w-3 mr-1" />
                {v.name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Klicken Sie auf eine Variable, um sie zu kopieren.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Betreff</label>
          <Input
            value={template.subject}
            onChange={(e) => updateField('subject', e.target.value)}
            placeholder="z.B. Entscheidungsanfrage: {decision_title}"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tipp: Verwenden Sie {"{decision_title}"} für den Titel der Entscheidung
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Begrüßung</label>
          <Input
            value={template.greeting}
            onChange={(e) => updateField('greeting', e.target.value)}
            placeholder="z.B. Hallo {participant_name},"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Einleitungstext</label>
          <Textarea
            value={template.introduction}
            onChange={(e) => updateField('introduction', e.target.value)}
            placeholder="Erklärung der Entscheidungsanfrage"
            rows={3}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Anweisungstext</label>
          <Textarea
            value={template.instruction}
            onChange={(e) => updateField('instruction', e.target.value)}
            placeholder="Anleitung für die Benutzer"
            rows={2}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Fragen-Prompt</label>
          <Input
            value={template.question_prompt}
            onChange={(e) => updateField('question_prompt', e.target.value)}
            placeholder="Text für den Fragen-Bereich"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Schlusstext</label>
          <Textarea
            value={template.closing}
            onChange={(e) => updateField('closing', e.target.value)}
            placeholder="Abschließende Worte"
            rows={2}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Signatur</label>
          <Input
            value={template.signature}
            onChange={(e) => updateField('signature', e.target.value)}
            placeholder="Unterschrift"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={saveTemplate} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Speichere..." : "Speichern"}
          </Button>
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Vorschau:</h4>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p><strong>Betreff:</strong> {template.subject}</p>
            <p>{template.greeting.replace('{participant_name}', 'Max Mustermann')}</p>
            <p>{template.introduction}</p>
            <p>{template.instruction}</p>
            <div className="bg-background p-2 rounded border">
              <p className="text-center">
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded mr-2">Ja</span>
                <span className="bg-red-100 text-red-800 px-3 py-1 rounded mr-2">Nein</span>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded">Frage</span>
              </p>
            </div>
            <p>{template.question_prompt}</p>
            <p>{template.closing}</p>
            <p>{template.signature}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
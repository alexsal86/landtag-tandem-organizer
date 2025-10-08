import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FailedRecipient {
  email: string;
  error: string;
}

interface EmailRetryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailLogId: string;
  failedRecipients: FailedRecipient[];
  emailSubject: string;
  emailBody: string;
  onRetrySuccess: () => void;
}

export function EmailRetryDialog({
  open,
  onOpenChange,
  emailLogId,
  failedRecipients,
  emailSubject,
  emailBody,
  onRetrySuccess
}: EmailRetryDialogProps) {
  const { toast } = useToast();
  const [selectedEmails, setSelectedEmails] = useState<string[]>(
    failedRecipients.map(r => r.email)
  );
  const [retrying, setRetrying] = useState(false);

  const handleToggle = (email: string) => {
    setSelectedEmails(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const handleRetry = async () => {
    if (selectedEmails.length === 0) {
      toast({
        title: "Keine Empfänger ausgewählt",
        description: "Bitte wählen Sie mindestens einen Empfänger aus.",
        variant: "destructive"
      });
      return;
    }

    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-document-email', {
        body: {
          subject: emailSubject,
          body_html: emailBody,
          recipient_emails: selectedEmails,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          tenant_id: null // Will be set by edge function
        }
      });

      if (error) throw error;

      const response = data as { success: boolean; sent: number; failed: number };

      if (response.success) {
        toast({
          title: "E-Mails erneut versendet",
          description: `${response.sent} von ${selectedEmails.length} E-Mails erfolgreich versendet.`
        });
        onRetrySuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "Teilweise fehlgeschlagen",
          description: `${response.sent} erfolgreich, ${response.failed} fehlgeschlagen.`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Fehler beim erneuten Versenden",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Mails erneut versenden</DialogTitle>
          <DialogDescription>
            Wählen Sie die Empfänger aus, an die die E-Mail erneut versendet werden soll.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {failedRecipients.map((recipient) => (
            <div
              key={recipient.email}
              className="flex items-start gap-3 p-3 border border-border rounded-lg"
            >
              <Checkbox
                checked={selectedEmails.includes(recipient.email)}
                onCheckedChange={() => handleToggle(recipient.email)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{recipient.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{recipient.error}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Badge variant="secondary">
            {selectedEmails.length} von {failedRecipients.length} ausgewählt
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleRetry}
              disabled={retrying || selectedEmails.length === 0}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Wird versendet...' : 'Erneut versenden'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

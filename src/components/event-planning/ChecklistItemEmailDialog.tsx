import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, X } from "lucide-react";

interface ChecklistItemEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistItemId: string;
  checklistItemTitle: string;
  existingAction?: {
    id: string;
    action_config: any;
    is_enabled: boolean;
  };
  onSaved: () => void;
}

export function ChecklistItemEmailDialog({
  open,
  onOpenChange,
  checklistItemId,
  checklistItemTitle,
  existingAction,
  onSaved,
}: ChecklistItemEmailDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [recipients, setRecipients] = useState<string[]>(
    existingAction?.action_config?.recipients || [""]
  );
  const [subject, setSubject] = useState(
    existingAction?.action_config?.subject || `✅ ${checklistItemTitle} - Erledigt`
  );
  const [message, setMessage] = useState(
    existingAction?.action_config?.message || 
    `Der Checklist-Punkt "${checklistItemTitle}" wurde als erledigt markiert.`
  );
  const [includeSenderInfo, setIncludeSenderInfo] = useState(
    existingAction?.action_config?.includeSenderInfo ?? true
  );
  const [isEnabled, setIsEnabled] = useState(
    existingAction?.is_enabled ?? true
  );

  const addRecipient = () => {
    setRecipients([...recipients, ""]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
  };

  const handleSave = async () => {
    const validRecipients = recipients.filter(r => r.trim() !== "");
    
    if (validRecipients.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte mindestens einen Empfänger angeben",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const actionConfig = {
        recipients: validRecipients,
        subject,
        message,
        includeSenderInfo,
      };

      if (existingAction) {
        // Update existing action
        const { error } = await supabase
          .from("event_planning_item_actions")
          .update({
            action_config: actionConfig,
            is_enabled: isEnabled,
          })
          .eq("id", existingAction.id);

        if (error) throw error;
      } else {
        // Create new action
        const { error } = await supabase
          .from("event_planning_item_actions")
          .insert({
            checklist_item_id: checklistItemId,
            action_type: "email",
            action_config: actionConfig,
            is_enabled: isEnabled,
          });

        if (error) throw error;
      }

      toast({
        title: "Erfolgreich gespeichert",
        description: "E-Mail-Automatisierung wurde konfiguriert",
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving email action:", error);
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Speichern",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-Mail-Automatisierung konfigurieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-base font-medium">E-Mail-Automatisierung aktiv</Label>
              <p className="text-sm text-muted-foreground">
                E-Mails werden beim Abhaken automatisch versendet
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {/* Checklist Item Info */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <Label className="text-sm text-muted-foreground">Checklist-Punkt</Label>
            <p className="font-medium mt-1">{checklistItemTitle}</p>
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <Label>Empfänger (E-Mail-Adressen)</Label>
            {recipients.map((recipient, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={recipient}
                  onChange={(e) => updateRecipient(index, e.target.value)}
                  className="flex-1"
                />
                {recipients.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRecipient(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRecipient}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Weiteren Empfänger hinzufügen
            </Button>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Betreff</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E-Mail Betreff"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Nachricht</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="E-Mail Nachricht"
              rows={6}
            />
          </div>

          {/* Include Sender Info */}
          <div className="flex items-center space-x-2">
            <Switch
              id="sender-info"
              checked={includeSenderInfo}
              onCheckedChange={setIncludeSenderInfo}
            />
            <Label htmlFor="sender-info" className="cursor-pointer">
              Absender-Informationen in E-Mail anzeigen
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItemEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistItemId: string;
  checklistItemTitle: string;
  onSaved: () => void;
}

export function ChecklistItemEmailDialog({
  open,
  onOpenChange,
  checklistItemId,
  checklistItemTitle,
  onSaved,
}: ChecklistItemEmailDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  // Load existing configuration
  useEffect(() => {
    if (open && checklistItemId) {
      loadEmailAction();
    }
  }, [open, checklistItemId]);

  const loadEmailAction = async () => {
    const { data, error } = await supabase
      .from("event_planning_item_actions")
      .select("*")
      .eq("checklist_item_id", checklistItemId)
      .eq("action_type", "email")
      .maybeSingle();

    if (error) {
      console.error("Error loading email action:", error);
      return;
    }

    if (data) {
      setActionId(data.id);
      setIsEnabled(data.is_enabled);
      const config = data.action_config as any;
      setRecipients(config.recipients || []);
      setSubject(config.subject || "");
      setMessage(config.message || "");
      setSenderName(config.sender_name || "");
      setSenderEmail(config.sender_email || "");
    } else {
      // Set default subject if creating new
      setSubject(`Checklisten-Punkt abgeschlossen: ${checklistItemTitle}`);
      setMessage(`Der Checklisten-Punkt "${checklistItemTitle}" wurde abgeschlossen.`);
    }
  };

  const addRecipient = () => {
    const email = newRecipient.trim();
    if (email && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setNewRecipient("");
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSave = async () => {
    if (recipients.length === 0) {
      toast({
        title: "Fehler",
        description: "Mindestens ein Empfänger muss angegeben werden.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const actionConfig = {
        recipients,
        subject,
        message,
        sender_name: senderName,
        sender_email: senderEmail,
      };

      if (actionId) {
        // Update existing
        const { error } = await supabase
          .from("event_planning_item_actions")
          .update({
            action_config: actionConfig,
            is_enabled: isEnabled,
          })
          .eq("id", actionId);

        if (error) throw error;
      } else {
        // Create new
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
        title: "Erfolg",
        description: "E-Mail-Automatisierung wurde gespeichert.",
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving email action:", error);
      toast({
        title: "Fehler",
        description: "E-Mail-Automatisierung konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!actionId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("event_planning_item_actions")
        .delete()
        .eq("id", actionId);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "E-Mail-Automatisierung wurde gelöscht.",
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting email action:", error);
      toast({
        title: "Fehler",
        description: "E-Mail-Automatisierung konnte nicht gelöscht werden.",
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
          <DialogTitle>E-Mail-Automatisierung konfigurieren</DialogTitle>
          <DialogDescription>
            E-Mail wird automatisch versendet, wenn "{checklistItemTitle}" abgehakt wird.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Automatisierung aktiviert</Label>
            <Switch
              id="enabled"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients">Empfänger</Label>
            <div className="flex gap-2">
              <Input
                id="recipients"
                type="email"
                placeholder="email@beispiel.de"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
              />
              <Button type="button" onClick={addRecipient}>
                Hinzufügen
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {recipients.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeRecipient(email)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Betreff</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E-Mail-Betreff"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Nachricht</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="E-Mail-Nachricht (HTML wird unterstützt)"
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">Absender-Name (optional)</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Ihr Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Absender-E-Mail (optional)</Label>
              <Input
                id="senderEmail"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="ihre@email.de"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {actionId && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                Löschen
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

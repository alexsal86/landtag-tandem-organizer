import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle } from "lucide-react";

export function EmployeeMeetingRequestDialog() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");

  const handleSubmit = async () => {
    if (!user || !currentTenant) return;
    if (!reason.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Grund für den Gesprächswunsch an",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("employee_meeting_requests").insert({
        employee_id: user.id,
        tenant_id: currentTenant.id,
        reason: reason.trim(),
        urgency,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Gesprächswunsch eingereicht",
        description: "Ihr Vorgesetzter wurde über Ihren Gesprächswunsch informiert.",
      });

      setOpen(false);
      setReason("");
      setUrgency("medium");
    } catch (error: any) {
      console.error("Error creating meeting request:", error);
      toast({
        title: "Fehler",
        description: error.message || "Gesprächswunsch konnte nicht erstellt werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircle className="mr-2 h-4 w-4" />
          Gespräch beantragen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Mitarbeitergespräch beantragen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="urgency">Dringlichkeit</Label>
            <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
              <SelectTrigger id="urgency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig - Reguläres Gespräch</SelectItem>
                <SelectItem value="medium">Mittel - Zeitnah gewünscht</SelectItem>
                <SelectItem value="high">Hoch - Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Grund / Anliegen</Label>
            <Textarea
              id="reason"
              placeholder="Beschreiben Sie kurz, worum es in dem Gespräch gehen soll..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
            />
            <p className="text-sm text-muted-foreground">
              Ihre Angaben werden vertraulich behandelt.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Wird eingereicht..." : "Gesprächswunsch einreichen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

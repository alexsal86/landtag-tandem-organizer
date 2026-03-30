import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Users, X } from "lucide-react";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { UserSelector } from "@/components/UserSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import type { ParticipantRole, NewMeetingParticipant } from "./types";

interface StandaloneMeetingCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingCreated?: () => void;
}

export function StandaloneMeetingCreator({ open, onOpenChange, onMeetingCreated }: StandaloneMeetingCreatorProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [isPublic, setIsPublic] = useState(false);
  const [participants, setParticipants] = useState<NewMeetingParticipant[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setMeetingDate(new Date());
    setMeetingTime("10:00");
    setIsPublic(false);
    setParticipants([]);
  };

  const handleCreate = async () => {
    if (!user || !currentTenant) return;
    if (!title.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie einen Titel ein!", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.from("meetings").insert([{
        title: title.trim(),
        description: description || null,
        meeting_date: format(meetingDate, "yyyy-MM-dd"),
        meeting_time: meetingTime,
        location: location || null,
        status: "planned",
        user_id: user.id,
        tenant_id: currentTenant.id,
        is_public: isPublic,
      }]).select().single();

      if (error) throw error;

      // Create calendar appointment
      if (data?.id) {
        const dateStr = format(meetingDate, "yyyy-MM-dd");
        const localStartTime = new Date(`${dateStr}T${meetingTime}:00`);
        const localEndTime = new Date(localStartTime.getTime() + 60 * 60 * 1000);
        await supabase.from("appointments").insert([{
          title: title.trim(),
          description: description || null,
          location: location || null,
          start_time: localStartTime.toISOString(),
          end_time: localEndTime.toISOString(),
          category: "meeting",
          status: "planned",
          user_id: user.id,
          tenant_id: currentTenant.id,
          meeting_id: data.id,
        }]).then(({ error: e }) => { if (e) debugConsole.error("Error creating appointment:", e); });
      }

      // Add participants
      if (participants.length > 0 && data?.id) {
        await supabase.from("meeting_participants").insert(
          participants.map(p => ({ meeting_id: data.id, user_id: p.userId, role: p.role, status: "pending" }))
        );
      }

      toast({ title: "Meeting erstellt", description: "Das Meeting wurde erfolgreich erstellt." });
      resetForm();
      onOpenChange(false);
      onMeetingCreated?.();
    } catch (error) {
      debugConsole.error("Error creating meeting:", error);
      toast({ title: "Fehler", description: "Meeting konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Meeting erstellen</DialogTitle>
          <DialogDescription>Erstellen Sie ein neues Meeting mit Teilnehmern</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Titel</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting Titel" />
          </div>
          <div>
            <label className="text-sm font-medium">Beschreibung</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Meeting Beschreibung" />
          </div>
          <div>
            <label className="text-sm font-medium">Ort</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Meeting Ort" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(meetingDate, "PPP", { locale: de })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={meetingDate} onSelect={(date) => date && setMeetingDate(date)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Startzeit</label>
              <TimePickerCombobox value={meetingTime} onChange={setMeetingTime} />
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Teilnehmer</label>
            </div>
            <UserSelector
              onSelect={(u) => {
                if (!participants.some(p => p.userId === u.id)) {
                  setParticipants([...participants, { userId: u.id, role: "participant", user: { id: u.id, display_name: u.display_name, avatar_url: u.avatar_url } }]);
                }
              }}
              placeholder="Teammitglied hinzufügen..."
              clearAfterSelect
              excludeUserIds={participants.map(p => p.userId)}
            />
            {participants.length > 0 && (
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div key={p.userId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <span className="flex-1 text-sm">{p.user?.display_name}</span>
                    <Select value={p.role} onValueChange={(v) => { const updated = [...participants]; updated[idx] = { ...p, role: v as ParticipantRole }; setParticipants(updated); }}>
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organizer">Organisator</SelectItem>
                        <SelectItem value="participant">Teilnehmer</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setParticipants(participants.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
            <Checkbox id="standalone_is_public" checked={isPublic} onCheckedChange={(checked) => setIsPublic(!!checked)} />
            <div className="flex-1">
              <label htmlFor="standalone_is_public" className="text-sm font-medium cursor-pointer">Öffentliches Meeting</label>
              <p className="text-xs text-muted-foreground">Alle Teammitglieder können dieses Meeting sehen</p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? "Erstelle…" : "Meeting erstellen"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

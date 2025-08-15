import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Meeting, MeetingTemplate } from "@/types/meeting";

interface MeetingFormProps {
  meeting?: Meeting;
  onSubmit: (meeting: Meeting) => Promise<void>;
  onCancel: () => void;
  meetingTemplates: MeetingTemplate[];
}

export function MeetingForm({ meeting, onSubmit, onCancel, meetingTemplates }: MeetingFormProps) {
  const [formData, setFormData] = useState<Meeting>({
    title: meeting?.title || "",
    description: meeting?.description || "",
    meeting_date: meeting?.meeting_date || new Date(),
    location: meeting?.location || "",
    status: meeting?.status || "planned",
    template_id: meeting?.template_id || "",
    id: meeting?.id
  });
  const [meetingTime, setMeetingTime] = useState<string>("10:00");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, meeting_date: date }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Titel *</label>
        <Input
          placeholder="Meeting-Titel"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Beschreibung</label>
        <Textarea
          placeholder="Meeting-Beschreibung (optional)"
          value={formData.description || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Datum *</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.meeting_date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.meeting_date ? (
                  format(formData.meeting_date, "dd. MMMM yyyy", { locale: de })
                ) : (
                  <span>Datum wählen</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(formData.meeting_date)}
                onSelect={handleDateSelect}
                initialFocus
                locale={de}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Uhrzeit</label>
          <Input
            type="time"
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Ort</label>
        <Input
          placeholder="Meeting-Ort (optional)"
          value={formData.location || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Status</label>
        <Select 
          value={formData.status} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planned">Geplant</SelectItem>
            <SelectItem value="in-progress">In Bearbeitung</SelectItem>
            <SelectItem value="completed">Abgeschlossen</SelectItem>
            <SelectItem value="cancelled">Abgesagt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!meeting && meetingTemplates.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Vorlage</label>
          <Select 
            value={formData.template_id || ""} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, template_id: value || undefined }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vorlage wählen (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Keine Vorlage</SelectItem>
              {meetingTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit">
          {meeting ? 'Aktualisieren' : 'Erstellen'}
        </Button>
      </div>
    </form>
  );
}
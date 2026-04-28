import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Star } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { useAuth } from "@/hooks/useAuth";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time?: string | null;
}

interface CaseItemMeetingSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (meetingId: string, meetingTitle: string) => void;
  onMarkForNextJourFixe: () => void;
}

export function CaseItemMeetingSelector({
  open,
  onOpenChange,
  onSelect,
  onMarkForNextJourFixe,
}: CaseItemMeetingSelectorProps) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && user) {
      loadMeetings();
    }
  }, [open, user]);

  const loadMeetings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const { data: ownMeetings, error: ownError } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, meeting_time")
        .eq("user_id", user.id)
        .gte("meeting_date", todayStr)
        .neq("status", "archived")
        .order("meeting_date", { ascending: true })
        .limit(10);

      if (ownError) throw ownError;

      const { data: participantMeetings } = await supabase
        .from("meeting_participants")
        .select("meeting_id, meetings(id, title, meeting_date, meeting_time, status)")
        .eq("user_id", user.id);

      const ownIds = new Set((ownMeetings || []).map((m: Record<string, any>) => m.id));
      const participantData = (participantMeetings || [])
        .filter(
          (p: any) =>
            p.meetings &&
            !ownIds.has(p.meeting_id) &&
            p.meetings.status !== "archived" &&
            p.meetings.meeting_date >= todayStr
        )
        .map((p: any) => p.meetings as Meeting);

      const allMeetings = [...(ownMeetings || []), ...participantData].sort(
        (a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime()
      );

      setMeetings(allMeetings);
    } catch (error) {
      debugConsole.error("Error loading meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatMeetingDate = (dateStr: string, time?: string | null) => {
    const date = new Date(dateStr);
    const dateFormatted = format(date, "EEEE, d. MMM", { locale: de });
    if (time) {
      return `${dateFormatted} um ${time.substring(0, 5)} Uhr`;
    }
    return dateFormatted;
  };

  const hasMeetings = !loading && meetings.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Vorgang zum Jour Fixe hinzufügen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Always show "mark for next" option */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-auto py-3"
            onClick={() => {
              onMarkForNextJourFixe();
              onOpenChange(false);
            }}
          >
            <Star className="h-4 w-4 text-amber-500" />
            <div className="text-left">
              <div className="font-medium">Für nächsten Jour Fixe vormerken</div>
              <div className="text-xs text-muted-foreground">
                Wird automatisch zum nächsten Meeting hinzugefügt
              </div>
            </div>
          </Button>

          {hasMeetings && (
            <>
              <Separator />
              <div className="text-sm font-medium text-muted-foreground">
                Oder einem bestimmten Meeting zuordnen:
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <Button
                      key={meeting.id}
                      variant="ghost"
                      className="w-full justify-start h-auto py-3 px-3"
                      onClick={() => {
                        onSelect(meeting.id, meeting.title);
                        onOpenChange(false);
                      }}
                    >
                      <div className="flex flex-col items-start gap-1 w-full">
                        <span className="font-medium truncate max-w-full">
                          {meeting.title}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {formatMeetingDate(meeting.meeting_date, meeting.meeting_time)}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import type { PreviousMeetingContext } from "../previousMeeting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";

export function PreviousMeetingReview({ context, reasons, onReason, disabled }: {
  context: PreviousMeetingContext; reasons: Record<string, string>; onReason: (id: string, value: string) => void; disabled: boolean;
}) {
  if (!context) return null;
  const { meeting, actions } = context;
  return <Card><CardHeader><CardTitle>Ziele aus dem letzten Gespräch (vom {new Date(meeting.meeting_date).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {meeting.protocol_data?.goals && <div><h4 className="font-medium">Ziele</h4><RichTextDisplay content={meeting.protocol_data.goals} /></div>}
      {meeting.protocol_data?.next_steps && <div><h4 className="font-medium">Nächste Schritte</h4><RichTextDisplay content={meeting.protocol_data.next_steps} /></div>}
      {actions.map(action => <div key={action.id} className="space-y-2 border-t pt-3">
        <p className={action.status === "completed" ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>{action.status === "completed" ? "Erreicht" : `Übernommen aus dem Gespräch vom ${new Date(meeting.meeting_date).toLocaleDateString("de-DE")}`}</p>
        <RichTextDisplay content={action.description} />
        {action.task_id && <Link to={`/tasks?highlight=${action.task_id}`} className="text-primary underline text-sm">Bestehende Aufgabe öffnen</Link>}
        {action.id && action.status !== "completed" && action.status !== "cancelled" && <Label className="block">Warum ist die Maßnahme noch offen?
          <Textarea disabled={disabled} value={reasons[action.id] ?? ""} onChange={e => onReason(action.id!, e.target.value)} />
        </Label>}
      </div>)}
      <Link className="text-primary underline text-sm" to={`/employee-meeting/${meeting.id}`}>Vorheriges Protokoll öffnen</Link>
    </CardContent>
  </Card>;
}

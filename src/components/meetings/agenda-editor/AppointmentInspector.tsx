import { meetingAppointmentTitle, employeeMeetingMetadata } from "../appointmentDisplay";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseMeetingResults } from "../platformAgendaRules";
import { generatedAgendaKey } from "./liveAgenda";
import { orderSystemSubpoints, agendaSubpointNumber } from "./systemSubpoints";
import type { AgendaItem, Meeting } from "../types";

export function AppointmentInspector({ meeting, parent, number, selectedKey, onSelect, onChange }: {
  meeting: Meeting; parent: AgendaItem; number?: string; selectedKey: string | null;
  onSelect: (key: string) => void; onChange?: (value: string) => void;
}) {
  const query = useQuery({
    queryKey: ["agenda-appointment-inspector", meeting.id, meeting.meeting_date],
    queryFn: async () => {
      const start = new Date(meeting.meeting_date); start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(end.getDate()+14); end.setHours(23,59,59,999);
      const internal = await supabase.from("appointments").select("id,title,start_time,end_time,location,description,category").eq("tenant_id", meeting.tenant_id!).gte("start_time",start.toISOString()).lte("start_time",end.toISOString());
      const external = await supabase.from("external_events").select("id,title,start_time,end_time,location,external_calendars!inner(name,tenant_id)").eq("external_calendars.tenant_id",meeting.tenant_id!).gte("start_time",start.toISOString()).lte("start_time",end.toISOString());
      if(internal.error) throw internal.error;
      if(external.error) throw external.error;
      return [...(internal.data ?? []).map(row=>({...row, source:"", title:meetingAppointmentTitle(row),description:employeeMeetingMetadata(row.description) ? null : row.description})), ...(external.data ?? []).map(row=>({...row, source:"extern",description:null}))].sort((a,b)=>a.start_time.localeCompare(b.start_time));
    },
  });
  const results = parseMeetingResults(parent.result_text);
  const entries = orderSystemSubpoints(query.data ?? [],results);
  const parentKey = parent.localKey || parent.id!;
  const index = entries.findIndex(entry=>generatedAgendaKey(parentKey,entry.id)===selectedKey);
  const current = entries[index];
  const patch = (id:string,value:object) => onChange?.(JSON.stringify({...results,[id]:{result:"",...results[id],...value}}));
  const time = (entry:typeof entries[number]) => {
    const date = new Date(entry.start_time);
    return date.toLocaleString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+
      "–"+new Date(entry.end_time).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+(entry.source ? " · extern":"")+(entry.location ? " · "+entry.location:"");
  };
  return <aside className="sticky top-4 space-y-3 rounded-xl border bg-card p-4">
    {current ? <>
      <p className="text-xs text-muted-foreground">Unterpunkt von {number} {parent.title}</p>
      <h3 className="font-semibold">{agendaSubpointNumber(number,index)} {current.title}</h3>
      <p className="text-xs text-muted-foreground">{time(current)}</p>
      {current.description && <p className="whitespace-pre-wrap text-sm">{current.description.replace(/<[^>]*>/g,"")}</p>}
      <label className="block space-y-1 text-sm"><span>Ergebnis</span><Textarea readOnly={!onChange} value={results[current.id]?.result ?? ""} onChange={event=>patch(current.id,{result:event.target.value})} /></label>
      <Button variant="ghost" size="sm" onClick={()=>onSelect(parentKey)}>Alle Unterpunkte</Button>
    </> : <>
      <h3 className="font-semibold">Unterpunkte ({entries.length})</h3>
      {query.isError && <p className="text-sm text-destructive">Termine konnten nicht geladen werden.</p>}
      {query.isPending && <p className="text-sm">Termine werden geladen …</p>}
      {entries.map(entry=><div key={entry.id} className="flex items-start gap-2 border-b py-2">
        <Checkbox aria-label={`Erledigt: ${entry.title}`} disabled={!onChange} checked={!!results[entry.id]?.completed} onCheckedChange={value=>patch(entry.id,{completed:value===true})}/>
        <button className="min-w-0 text-left text-sm" onClick={()=>onSelect(generatedAgendaKey(parentKey,entry.id))}>{entry.title}<span className="block text-xs text-muted-foreground">{time(entry)}</span></button>
      </div>)}
    </>}
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/calendar?action=create-appointment">+ Termin</Link></Button><Button asChild variant="outline" size="sm"><Link to="/calendar">Kalender öffnen</Link></Button></div>
  </aside>;
}

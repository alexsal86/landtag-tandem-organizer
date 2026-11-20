import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { AgendaResultEditor, type AgendaResult } from "../AgendaResultEditor";
import type { AgendaItem, Meeting } from "../types";

export function LiveAgendaResult({ meeting, item, onChange, onTransfer }: {
  meeting: Meeting;
  item: AgendaItem;
  onChange: (result: AgendaResult) => void;
  onTransfer: (value: boolean) => void;
}) {
  const { tenant_id: tenantId, template_id: templateId, meeting_date: meetingDate } = meeting;
  const meetingDay = new Date(meetingDate).toISOString().slice(0, 10);
  const transfer = useQuery({
    queryKey: ['jour-fixe-transfer-target', tenantId, templateId, meetingDay],
    enabled: Boolean(tenantId && templateId),
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings')
        .select('title, meeting_date, meeting_time')
        .eq('tenant_id', tenantId!)
        .eq('template_id', templateId!)
        .eq('status', 'planned')
        .gt('meeting_date', meetingDay)
        .order('meeting_date')
        .order('id')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const nextMeeting = transfer.data;
  const transferTarget = nextMeeting
    ? `${nextMeeting.title} · ${format(new Date(`${nextMeeting.meeting_date}T00:00:00`), 'dd.MM.yyyy')}${nextMeeting.meeting_time ? ` um ${nextMeeting.meeting_time.slice(0, 5)} Uhr` : ''}`
    : transfer.isError ? 'Übertragungsziel konnte nicht geladen werden'
      : transfer.isPending ? 'Übertragungsziel wird geladen …'
        : 'Zwischenspeicher · noch kein Folgetermin geplant';

  const renderTransfer = () => {
    if (!tenantId || !templateId || !item.id) return null;
    const checkboxId = `carryover-${item.id}`;
    return (
      <div className="flex items-start gap-2 text-sm">
        <Checkbox id={checkboxId} checked={!!item.carry_over_to_next} onCheckedChange={checked => onTransfer(checked === true)} />
        <label htmlFor={checkboxId} className="flex flex-wrap items-center gap-x-2 gap-y-1 cursor-pointer">
          <span>Auf nächste Besprechung übertragen</span>
          {item.carry_over_to_next && <Badge variant="secondary">Vorgemerkt</Badge>}
          <span className="text-muted-foreground">→ {transferTarget}</span>
        </label>
      </div>
    );
  };

  const downloadFile = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const fileName = filePath.split('/').pop()?.split('_').slice(2).join('_') || 'download';
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      notify.error("Download-Fehler", { description: "Datei konnte nicht heruntergeladen werden." });
    }
  };

  return (
    <div className="space-y-2 px-4 pb-3 pl-[3.75rem]">
      <p className="text-xs font-medium">Ergebnis</p>
      <AgendaResultEditor item={item} onChange={onChange} placeholder="Ergebnis oder Beschluss festhalten …" />
      {renderTransfer()}
      {item.file_path && (
        <Button size="sm" variant="outline" onClick={() => void downloadFile(item.file_path!)}>
          <Download className="mr-2 size-4" /> Anhang laden
        </Button>
      )}
    </div>
  );
}

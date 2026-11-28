import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import type { TimelineInteractionType } from "@/components/my-work/hooks/useCaseItemEdit";

export type InteractionType = "call" | "email" | "social" | "meeting" | "note" | "letter" | "system";
export type InteractionDirection = "inbound" | "outbound" | "internal";

const QUICK_CAPTURE_TO_TIMELINE_TYPE: Record<InteractionType, TimelineInteractionType> = {
  call: "anruf",
  email: "mail",
  meeting: "treffen",
  note: "notiz",
  social: "gespraech",
  letter: "notiz",
  system: "notiz",
};

type SourceType = "contacts" | "documents" | "letters" | "tasks";

interface Props {
  title: string;
  interactionType: InteractionType;
  defaultDirection: InteractionDirection;
  caseFileId: string;
  onCreate: (payload: {
    case_file_id: string;
    interaction_type: InteractionType;
    timeline_interaction_type: TimelineInteractionType;
    direction: InteractionDirection;
    subject: string;
    details?: string;
    is_resolution: boolean;
    source_type?: SourceType;
    source_id?: string;
  }) => Promise<boolean>;
}

/**
 * Erwähnungen im Detail-HTML meldet der Trigger auf case_item_interactions im Mandanten
 * des Vorgangs. Der Client verschickt dafür bewusst keine eigene Meldung mehr: die
 * 6-Argument-Fassung von create_notification löst den Mandanten über den Hauptmandanten
 * der Person auf und landet bei mehreren Mitgliedschaften im falschen Arbeitsbereich.
 */
export function CaseItemInteractionQuickCapture({ title, interactionType, defaultDirection, caseFileId, onCreate }: Props) {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [detailsEditorKey, setDetailsEditorKey] = useState(0);
  const [direction, setDirection] = useState<InteractionDirection>(defaultDirection);
  const [isResolution, setIsResolution] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType | "none">("none");
  const [sourceId, setSourceId] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => subject.trim().length > 0 && !saving, [subject, saving]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const success = await onCreate({
      case_file_id: caseFileId,
      interaction_type: interactionType,
      timeline_interaction_type: QUICK_CAPTURE_TO_TIMELINE_TYPE[interactionType],
      direction,
      subject: subject.trim(),
      details: details.trim() || undefined,
      is_resolution: isResolution,
      source_type: sourceType === "none" ? undefined : sourceType,
      source_id: sourceId.trim() || undefined,
    });

    if (success) {
      setSubject("");
      setDetails("");
      setDetailsEditorKey((k) => k + 1);
      setSourceType("none");
      setSourceId("");
      setIsResolution(false);
      setDirection(defaultDirection);
    }

    setSaving(false);
  };

  return (
    <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Betreff</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kurzbeschreibung" />
          </div>
          <div className="grid gap-1.5">
            <Label>Richtung</Label>
            <Select value={direction} onValueChange={(v: InteractionDirection) => setDirection(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="internal">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Details</Label>
            <SimpleRichTextEditor
              initialContent={details}
              contentVersion={detailsEditorKey}
              onChange={setDetails}
              minHeight="80px"
              placeholder="Details eingeben... Nutze @, um Personen zu erwähnen"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>source_type (optional)</Label>
              <Select value={sourceType} onValueChange={(v: SourceType | "none") => setSourceType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Link</SelectItem>
                  <SelectItem value="contacts">contacts</SelectItem>
                  <SelectItem value="documents">documents</SelectItem>
                  <SelectItem value="letters">letters</SelectItem>
                  <SelectItem value="tasks">tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>source_id (UUID)</Label>
              <Input value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isResolution} onChange={(e) => setIsResolution(e.target.checked)} />
            Als Abschlussinteraktion markieren (resolution)
          </label>
          <Button size="sm" className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Speichern..." : "Interaktion speichern"}
          </Button>
        </CardContent>
    </Card>
  );
}

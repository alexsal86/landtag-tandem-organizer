import { useState } from "react";
import { CaseFile } from "@/hooks/useCaseFiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Info, Edit2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CaseFileCurrentStatusProps {
  caseFile: CaseFile;
  onUpdate: (note: string) => Promise<boolean>;
}

export function CaseFileCurrentStatus({ caseFile, onUpdate }: CaseFileCurrentStatusProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(caseFile.current_status_note || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const success = await onUpdate(editValue);
    setSaving(false);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(caseFile.current_status_note || "");
    setIsEditing(false);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Aktueller Stand
          </span>
          {!isEditing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditValue(caseFile.current_status_note || "");
                setIsEditing(true);
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Aktuellen Stand beschreiben..."
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Check className="mr-1 h-3.5 w-3.5" />
                {saving ? "Speichern..." : "Speichern"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="mr-1 h-3.5 w-3.5" />
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {caseFile.current_status_note ? (
              <p className="text-sm whitespace-pre-wrap">{caseFile.current_status_note}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Noch kein aktueller Stand eingetragen. Klicke auf den Stift um einen hinzuzufügen.
              </p>
            )}
            {caseFile.current_status_updated_at && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Zuletzt aktualisiert: {format(new Date(caseFile.current_status_updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

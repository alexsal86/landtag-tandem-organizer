import { useState, useEffect } from "react";
import { CaseFile } from "@/hooks/useCaseFiles";
import { useCaseFileProcessingStatuses } from "@/hooks/useCaseFileProcessingStatuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserBadge } from "@/components/ui/user-badge";
import { Info, Edit2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { icons, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface StatusHistoryEntry {
  id: string;
  content: string | null;
  user_id: string;
  user_display_name: string | null;
  created_at: string;
}

interface CaseFileCurrentStatusProps {
  caseFile: CaseFile;
  onUpdate: (note: string) => Promise<boolean>;
  onUpdateProcessingStatus?: (status: string | null) => Promise<boolean>;
}

export function CaseFileCurrentStatus({ caseFile, onUpdate, onUpdateProcessingStatus }: CaseFileCurrentStatusProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(caseFile.current_status_note || "");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const { statuses: processingStatuses } = useCaseFileProcessingStatuses();

  const currentProcessingStatus = (caseFile as any).processing_status;

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || null;
  };

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory, caseFile.id]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('case_file_status_history' as any)
        .select('*')
        .eq('case_file_id', caseFile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory((data || []) as unknown as StatusHistoryEntry[]);
    } catch (error) {
      console.error('Error loading status history:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    // Save current note to history before updating
    if (caseFile.current_status_note) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
          .single();

        await supabase.from('case_file_status_history' as any).insert({
          case_file_id: caseFile.id,
          content: caseFile.current_status_note,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          user_display_name: profile?.display_name || null,
        });
      } catch (error) {
        console.error('Error saving history:', error);
      }
    }

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

  const handleProcessingStatusChange = async (statusName: string) => {
    if (!onUpdateProcessingStatus) return;
    const newStatus = statusName === currentProcessingStatus ? null : statusName;
    await onUpdateProcessingStatus(newStatus);
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
      <CardContent className="p-4 pt-0 space-y-3">
        {/* Processing Status Selection */}
        <div className="flex flex-wrap gap-1.5">
          {processingStatuses.map((status) => {
            const StatusIcon = getIconComponent(status.icon);
            const isSelected = currentProcessingStatus === status.name;
            return (
              <button
                key={status.id}
                onClick={() => handleProcessingStatusChange(status.name)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer",
                  isSelected
                    ? "border-transparent text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
                style={isSelected ? { backgroundColor: status.color || '#6b7280' } : undefined}
              >
                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                {status.label}
              </button>
            );
          })}
        </div>

        {/* Status Note */}
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

        {/* History Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          Verlauf {showHistory ? "ausblenden" : "anzeigen"}
        </Button>

        {showHistory && history.length > 0 && (
          <div className="space-y-2 border-t pt-2">
            {history.map((entry) => (
              <div key={entry.id} className="text-xs space-y-0.5 p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{entry.user_display_name || 'Unbekannt'}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(entry.created_at), "dd.MM.yy HH:mm", { locale: de })}
                  </span>
                </div>
                {entry.content && (
                  <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{entry.content}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {showHistory && history.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Noch kein Verlauf vorhanden</p>
        )}
      </CardContent>
    </Card>
  );
}

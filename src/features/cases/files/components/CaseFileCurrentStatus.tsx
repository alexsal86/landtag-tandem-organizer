import { useState, useEffect } from "react";
import { CaseFile } from "@/features/cases/files/hooks";
import { useCaseFileProcessingStatuses } from "@/hooks/useCaseFileProcessingStatuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Info, Edit2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { getLucideIcon } from "@/utils/iconUtils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { getCaseFileProcessingStatuses } from "@/features/cases/shared/utils/caseInteropAdapters";
import { debugConsole } from "@/utils/debugConsole";
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
  onUpdateProcessingStatuses?: (statuses: string[]) => Promise<boolean>;
}

export function CaseFileCurrentStatus({ caseFile, onUpdate, onUpdateProcessingStatuses }: CaseFileCurrentStatusProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(caseFile.current_status_note || "");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const { statuses: processingStatuses } = useCaseFileProcessingStatuses();

  const currentProcessingStatuses: string[] = getCaseFileProcessingStatuses(caseFile as unknown as Record<string, unknown>);

  const getIconComponent = (iconName?: string | null): LucideIcon | null => {
    if (!iconName) return null;
    return getLucideIcon(iconName);
  };

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory, caseFile.id]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('case_file_status_history')
        .select('id, case_file_id, content, user_id, user_display_name, created_at')
        .eq('case_file_id', caseFile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory((data || []) as StatusHistoryEntry[]);
    } catch (error) {
      debugConsole.error('Error loading status history:', error);
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

        await supabase.from('case_file_status_history').insert([{
          case_file_id: caseFile.id,
          content: caseFile.current_status_note,
          user_id: (await supabase.auth.getUser()).data.user?.id ?? '',
          user_display_name: profile?.display_name || null,
        }]);
      } catch (error) {
        debugConsole.error('Error saving history:', error);
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
    if (!onUpdateProcessingStatuses) return;
    const isSelected = currentProcessingStatuses.includes(statusName);
    const newStatuses = isSelected
      ? currentProcessingStatuses.filter(s => s !== statusName)
      : [...currentProcessingStatuses, statusName];
    await onUpdateProcessingStatuses(newStatuses);
  };

  return (
    <Card className="border-primary/30 bg-primary/5 overflow-hidden">
      <CardHeader className="p-4 pb-2 bg-primary/10 border-b border-primary/20">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2 text-primary">
            <Info className="h-4 w-4" />
            Aktueller Stand
          </span>
          {!isEditing && (
            <button
              onClick={() => {
                setEditValue(caseFile.current_status_note || "");
                setIsEditing(true);
              }}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <Edit2 className="h-3 w-3" />
              bearbeiten
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {/* Processing Status Selection */}
        <div className="flex flex-wrap gap-1.5">
          {processingStatuses.map((status) => {
            const StatusIcon = getIconComponent(status.icon);
            const isSelected = currentProcessingStatuses.includes(status.name);
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
            <SimpleRichTextEditor
              initialContent={editValue}
              onChange={(html) => setEditValue(html)}
              placeholder="Aktuellen Stand beschreiben..."
              minHeight="100px"
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
              <RichTextDisplay content={caseFile.current_status_note} className="text-foreground" />
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
                  <RichTextDisplay content={entry.content} className="text-muted-foreground [&_p]:line-clamp-3" />
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

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, ChevronDown, ChevronUp, Loader2, Mail } from "lucide-react";
import { useCreateEntry } from "../hooks/useDossierEntries";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import { isEmailFile, isEmlFile, isMsgFile, parseEmlFile, parseMsgFile, buildEmlFromOutlookHtml } from "@/utils/emlParser";

interface SmartCaptureProps {
  dossierId?: string | null;
}

const URL_REGEX = /^https?:\/\//i;

export function SmartCapture({ dossierId = null }: SmartCaptureProps) {
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createEntry = useCreateEntry();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  const isPending = createEntry.isPending || uploading;

  const handleSubmit = useCallback(() => {
    const val = text.trim();
    if (!val) return;

    if (URL_REGEX.test(val)) {
      // Auto-detect as link
      const title = val.replace(/^https?:\/\//, "").slice(0, 80);
      createEntry.mutate(
        { dossier_id: dossierId, entry_type: "link", title, source_url: val },
        { onSuccess: () => { setText(""); setExpanded(false); } }
      );
    } else {
      // Save as note
      const title = val.slice(0, 80).split("\n")[0];
      createEntry.mutate(
        { dossier_id: dossierId, entry_type: "notiz", title, content: val },
        { onSuccess: () => { setText(""); setExpanded(false); } }
      );
    }
  }, [text, dossierId, createEntry]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTenant?.id || !profileId) return;
    setUploading(true);
    try {
      // Check for email files
      if (isEmailFile(file)) {
        let metadata: Record<string, unknown> = {};
        if (isEmlFile(file)) {
          const parsed = await parseEmlFile(file);
          metadata = { subject: parsed.metadata.subject, from: parsed.metadata.from, to: parsed.metadata.to, date: parsed.metadata.date };
        } else if (isMsgFile(file)) {
          const parsed = await parseMsgFile(file);
          metadata = { subject: parsed.metadata.subject, from: parsed.metadata.from, to: parsed.metadata.to, date: parsed.metadata.date };
        }
        const path = `${currentTenant.id}/dossiers/${crypto.randomUUID()}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
        if (uploadError) throw uploadError;
        createEntry.mutate({
          dossier_id: dossierId,
          entry_type: "email",
          title: (metadata.subject as string) || file.name,
          file_path: path,
          file_name: file.name,
          metadata,
        });
      } else {
        const path = `${currentTenant.id}/dossiers/${crypto.randomUUID()}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
        if (uploadError) throw uploadError;
        createEntry.mutate({
          dossier_id: dossierId,
          entry_type: "datei",
          title: file.name,
          file_path: path,
          file_name: file.name,
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [dossierId, currentTenant?.id, profileId, createEntry]);

  // Handle Outlook paste
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData("text/html");
    if (html) {
      const syntheticEml = buildEmlFromOutlookHtml(html);
      if (syntheticEml) {
        e.preventDefault();
        try {
          const parsed = await parseEmlFile(syntheticEml);
          const metadata = {
            subject: parsed.metadata.subject,
            from: parsed.metadata.from,
            to: parsed.metadata.to,
            date: parsed.metadata.date,
          };
          if (!currentTenant?.id || !profileId) return;
          createEntry.mutate({
            dossier_id: dossierId,
            entry_type: "email",
            title: parsed.metadata.subject || "E-Mail (eingefügt)",
            content: parsed.textBody || parsed.htmlBody || "",
            metadata,
          });
          toast.success("E-Mail aus Outlook eingefügt");
        } catch {
          toast.error("E-Mail konnte nicht verarbeitet werden");
        }
      }
    }
  }, [dossierId, currentTenant?.id, profileId, createEntry]);

  return (
    <div className="rounded-lg border border-border bg-card" onPaste={handlePaste}>
      <div className="flex items-center gap-2 p-2">
        {expanded ? (
          <Textarea
            placeholder="Notiz, Link oder E-Mail einfügen …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[80px] text-sm border-0 shadow-none focus-visible:ring-0 resize-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
        ) : (
          <Input
            placeholder="Notiz, Link oder @Kontakt hinzufügen …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            onFocus={() => {
              if (text.length > 60) setExpanded(true);
            }}
          />
        )}

        <div className="flex items-center gap-1 shrink-0 pr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            type="button"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>

          <Button
            size="icon"
            className="h-8 w-8"
            onClick={handleSubmit}
            disabled={isPending || !text.trim()}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span>E-Mail per Strg+V einfügen · URLs werden automatisch als Link gespeichert</span>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
        disabled={uploading}
      />
    </div>
  );
}

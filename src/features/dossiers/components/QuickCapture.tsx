import { useState, useCallback, useRef } from "react";
import { Paperclip, Send, Loader2 } from "lucide-react";
import { useCreateEntry } from "../hooks/useDossierEntries";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import { isEmailFile, isEmlFile, isMsgFile, parseEmlFile, parseMsgFile, buildEmlFromOutlookHtml } from "@/utils/emlParser";

const URL_REGEX = /^https?:\/\//i;

interface QuickCaptureProps {
  dossierId?: string | null;
}

export function QuickCapture({ dossierId = null }: QuickCaptureProps) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createEntry = useCreateEntry();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  const isPending = createEntry.isPending || uploading;

  const handleSubmit = useCallback(() => {
    const val = text.trim();
    if (!val) return;

    if (URL_REGEX.test(val)) {
      const title = val.replace(/^https?:\/\//, "").slice(0, 80);
      createEntry.mutate(
        { dossier_id: dossierId, entry_type: "link", title, source_url: val },
        { onSuccess: () => setText("") }
      );
    } else {
      const title = val.slice(0, 80).split("\n")[0];
      createEntry.mutate(
        { dossier_id: dossierId, entry_type: "notiz", title, content: val },
        { onSuccess: () => setText("") }
      );
    }
  }, [text, dossierId, createEntry]);

  const processFile = useCallback(async (file: File) => {
    if (!currentTenant?.id || !profileId) return;
    setUploading(true);
    try {
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
    }
  }, [currentTenant?.id, profileId, dossierId, createEntry]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

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

    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          return;
        }
      }
    }
  }, [currentTenant?.id, profileId, dossierId, createEntry, processFile]);

  return (
    <div
      className={`rounded-md border transition-colors ${
        dragOver
          ? "border-primary bg-primary/10"
          : "border-border"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <div className="flex items-center gap-1 p-1.5">
        <input
          type="text"
          placeholder="Notiz, Link oder Datei…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="flex-1 min-w-0 bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-1.5 py-1"
          disabled={isPending}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          title="Datei auswählen"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !text.trim()}
          className="shrink-0 p-1 rounded bg-primary/80 text-primary-foreground hover:bg-primary transition-colors disabled:opacity-30"
          title="Absenden"
        >
          {isPending && !uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
    </div>
  );
}

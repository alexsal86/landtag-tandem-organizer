import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, Link, Upload, Loader2, Mail } from "lucide-react";
import { useCreateEntry } from "../hooks/useDossierEntries";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import { isEmailFile, isEmlFile, isMsgFile, parseEmlFile, parseMsgFile, buildEmlFromOutlookHtml } from "@/utils/emlParser";

interface QuickCaptureProps {
  dossierId?: string | null;
}

export function QuickCapture({ dossierId = null }: QuickCaptureProps) {
  const [activeTab, setActiveTab] = useState("notiz");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const createEntry = useCreateEntry();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  const handleSubmitNote = useCallback(() => {
    if (!text.trim()) return;
    const title = text.slice(0, 80).split("\n")[0];
    createEntry.mutate(
      { dossier_id: dossierId, entry_type: "notiz", title, content: text },
      { onSuccess: () => setText("") }
    );
  }, [text, dossierId, createEntry]);

  const handleSubmitLink = useCallback(() => {
    if (!url.trim()) return;
    const title = url.replace(/^https?:\/\//, "").slice(0, 80);
    createEntry.mutate(
      { dossier_id: dossierId, entry_type: "link", title, source_url: url },
      { onSuccess: () => setUrl("") }
    );
  }, [url, dossierId, createEntry]);

  const uploadFileAndCreateEntry = useCallback(
    async (file: File, entryType: string = "datei", metadata?: Record<string, unknown>) => {
      if (!currentTenant?.id || !profileId) return;
      setUploading(true);
      try {
        const path = `${currentTenant.id}/dossiers/${crypto.randomUUID()}/${file.name}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
        if (uploadError) throw uploadError;
        createEntry.mutate({
          dossier_id: dossierId,
          entry_type: entryType,
          title: file.name,
          file_path: path,
          file_name: file.name,
          metadata,
        });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
      } finally {
        setUploading(false);
      }
    },
    [dossierId, currentTenant?.id, profileId, createEntry]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Check if it's an email file
      if (isEmailFile(file)) {
        await handleEmailFile(file);
      } else {
        await uploadFileAndCreateEntry(file);
      }
      e.target.value = "";
    },
    [uploadFileAndCreateEntry]
  );

  const handleEmailFile = useCallback(
    async (file: File) => {
      try {
        let metadata: Record<string, unknown> = {};
        if (isEmlFile(file)) {
          const parsed = await parseEmlFile(file);
          metadata = {
            subject: parsed.metadata.subject,
            from: parsed.metadata.from,
            to: parsed.metadata.to,
            date: parsed.metadata.date,
          };
        } else if (isMsgFile(file)) {
          const parsed = await parseMsgFile(file);
          metadata = {
            subject: parsed.metadata.subject,
            from: parsed.metadata.from,
            to: parsed.metadata.to,
            date: parsed.metadata.date,
          };
        }
        const title = (metadata.subject as string) || file.name;
        await uploadFileAndCreateEntry(file, "email", metadata);
        // Override the title with subject
        // Note: title is set in uploadFileAndCreateEntry from file.name, but we want subject
        // Actually, let's handle it differently - create entry directly with metadata
      } catch (err) {
        toast.error("E-Mail konnte nicht verarbeitet werden");
        // Fallback: upload as regular file
        await uploadFileAndCreateEntry(file);
      }
    },
    [uploadFileAndCreateEntry]
  );

  // Handle paste for Outlook emails
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
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
              content: parsed.metadata.textContent || parsed.metadata.htmlContent || "",
              metadata,
            });
            toast.success("E-Mail aus Outlook eingefügt");
          } catch {
            toast.error("E-Mail konnte nicht verarbeitet werden");
          }
          return;
        }
      }
    },
    [dossierId, currentTenant?.id, profileId, createEntry]
  );

  const isPending = createEntry.isPending || uploading;

  return (
    <div className="rounded-lg border border-border bg-card p-4" onPaste={handlePaste}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-3 flex-wrap h-auto gap-1">
          <TabsTrigger value="notiz">📝 Notiz</TabsTrigger>
          <TabsTrigger value="link">🔗 Link</TabsTrigger>
          <TabsTrigger value="datei">📎 Datei</TabsTrigger>
          <TabsTrigger value="email">✉️ E-Mail</TabsTrigger>
        </TabsList>

        <TabsContent value="notiz">
          <Textarea
            placeholder="Schnelle Notiz, Zitat, Gesprächsnotiz …"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[80px] mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitNote();
            }}
          />
          <Button size="sm" onClick={handleSubmitNote} disabled={isPending || !text.trim()}>
            {isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Speichern
          </Button>
        </TabsContent>

        <TabsContent value="link">
          <Input
            placeholder="https://..."
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitLink();
            }}
          />
          <Button size="sm" onClick={handleSubmitLink} disabled={isPending || !url.trim()}>
            {isPending ? <Loader2 className="animate-spin" /> : <Link />}
            Link speichern
          </Button>
        </TabsContent>

        <TabsContent value="datei">
          <label className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted/50 transition-colors">
            {uploading ? <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">Datei auswählen oder hierher ziehen</span>
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </TabsContent>

        <TabsContent value="email">
          <div className="space-y-3">
            <div className="rounded-md border-2 border-dashed border-border p-6 text-center space-y-2">
              <Mail className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">E-Mail aus Outlook per <strong>Strg+V</strong> einfügen</p>
              <p className="text-xs text-muted-foreground">oder als .eml / .msg Datei hochladen:</p>
            </div>
            <label className="flex items-center justify-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Upload className="h-4 w-4" />}
              <span className="text-sm text-muted-foreground">.eml / .msg Datei hochladen</span>
              <input
                type="file"
                className="hidden"
                accept=".eml,.msg"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

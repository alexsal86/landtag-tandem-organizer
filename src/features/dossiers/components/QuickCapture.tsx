import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, Link, Upload, Loader2 } from "lucide-react";
import { useCreateEntry } from "../hooks/useDossierEntries";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";

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

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentTenant?.id || !profileId) return;
      setUploading(true);
      try {
        const path = `${currentTenant.id}/dossiers/${crypto.randomUUID()}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, file);
        if (uploadError) throw uploadError;
        createEntry.mutate({
          dossier_id: dossierId,
          entry_type: "datei",
          title: file.name,
          file_path: path,
          file_name: file.name,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
        console.error(msg);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [dossierId, currentTenant?.id, profileId, createEntry]
  );

  const isPending = createEntry.isPending || uploading;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="notiz">📝 Notiz</TabsTrigger>
          <TabsTrigger value="link">🔗 Link</TabsTrigger>
          <TabsTrigger value="datei">📎 Datei</TabsTrigger>
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
      </Tabs>
    </div>
  );
}

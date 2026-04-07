import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useCreateDossierSourceWatcher,
  useDeleteDossierSourceWatcher,
  useDossierSourceWatchers,
  useRunDossierSourceSync,
} from "../hooks/useDossierSourceWatchers";

interface Props {
  dossierId: string;
}

export function DossierSourceWatchersPanel({ dossierId }: Props) {
  const { data: watchers } = useDossierSourceWatchers(dossierId);
  const createWatcher = useCreateDossierSourceWatcher();
  const deleteWatcher = useDeleteDossierSourceWatcher();
  const runSync = useRunDossierSourceSync();

  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<"rss" | "presse" | "verband">("rss");
  const [keywordsText, setKeywordsText] = useState("");

  const handleAdd = () => {
    const keywords = keywordsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    createWatcher.mutate(
      { dossier_id: dossierId, source_name: sourceName.trim(), source_url: sourceUrl.trim(), source_type: sourceType, keywords },
      {
        onSuccess: () => {
          setSourceName("");
          setSourceUrl("");
          setKeywordsText("");
        },
      }
    );
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Externe Quellen</h3>
        <Button variant="outline" size="sm" onClick={() => runSync.mutate(dossierId)} disabled={runSync.isPending}>
          {runSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Jetzt prüfen
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Quellenname</Label>
          <Input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="z. B. Landtag News" />
        </div>
        <div className="space-y-1">
          <Label>Quelle</Label>
          <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://.../rss" />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Typ</Label>
          <Select value={sourceType} onValueChange={(value: "rss" | "presse" | "verband") => setSourceType(value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rss">RSS</SelectItem>
              <SelectItem value="presse">Presse</SelectItem>
              <SelectItem value="verband">Verbandsquelle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Keywords (kommagetrennt)</Label>
          <Input value={keywordsText} onChange={(event) => setKeywordsText(event.target.value)} placeholder="Verkehr, ÖPNV, Haushalt" />
        </div>
      </div>

      <Button onClick={handleAdd} disabled={!sourceName.trim() || !sourceUrl.trim() || createWatcher.isPending}>
        Quelle hinzufügen
      </Button>

      <div className="space-y-2">
        {(watchers ?? []).map((watcher) => (
          <div key={watcher.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{watcher.source_name}</p>
                <p className="text-xs text-muted-foreground break-all">{watcher.source_url}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="secondary">{watcher.source_type}</Badge>
                  {watcher.keywords.map((keyword) => <Badge key={keyword} variant="outline">{keyword}</Badge>)}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteWatcher.mutate(watcher.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

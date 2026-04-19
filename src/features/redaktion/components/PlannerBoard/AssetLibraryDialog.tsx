import { useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Upload, Tag as TagIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSocialAssets } from "@/features/redaktion/hooks/useSocialAssets";

interface AssetLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (publicUrl: string) => void;
}

export function AssetLibraryDialog({ open, onOpenChange, onSelect }: AssetLibraryDialogProps) {
  const { toast } = useToast();
  const { assets, loading, allTags, uploadAsset, updateTags } = useSocialAssets();
  const [filterTag, setFilterTag] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [uploadTags, setUploadTags] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    if (filterTag === "all") return assets;
    return assets.filter((a) => a.tags.includes(filterTag));
  }, [assets, filterTag]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const tags = uploadTags.split(",").map((t) => t.trim()).filter(Boolean);
      await uploadAsset(file, tags);
      setUploadTags("");
      toast({ title: "Asset hochgeladen" });
    } catch (err) {
      toast({ title: "Upload fehlgeschlagen", description: String(err instanceof Error ? err.message : err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Asset-Bibliothek
          </DialogTitle>
          <DialogDescription>
            Wiederverwendbare Bilder. Letzte 30 Uploads, gefiltert nach Tags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="asset-tags">Tags für neuen Upload (Komma-getrennt)</Label>
              <Input id="asset-tags" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="z. B. Logo, Wahlkreis-Bild" />
            </div>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Lade hoch…" : "Bild hochladen"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge
                variant={filterTag === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterTag("all")}
              >
                Alle
              </Badge>
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={filterTag === tag ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {loading && <p className="text-xs text-muted-foreground">Lade Assets…</p>}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Assets in der Bibliothek.</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((asset) => (
              <div key={asset.id} className="group relative overflow-hidden rounded-md border">
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => {
                    onSelect(asset.public_url);
                    onOpenChange(false);
                  }}
                  title="Asset übernehmen"
                >
                  <img src={asset.public_url} alt={asset.file_name} className="aspect-square h-32 w-full object-cover transition group-hover:opacity-80" />
                </button>
                <div className="p-2">
                  <p className="truncate text-xs font-medium" title={asset.file_name}>{asset.file_name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {asset.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                  <Input
                    className="mt-1 h-7 text-xs"
                    placeholder="Tags ändern…"
                    defaultValue={asset.tags.join(", ")}
                    onBlur={(e) => {
                      const next = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                      const same = next.length === asset.tags.length && next.every((t, i) => t === asset.tags[i]);
                      if (!same) void updateTags(asset.id, next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

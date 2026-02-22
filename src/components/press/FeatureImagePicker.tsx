import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Image, Loader2, Search, X } from "lucide-react";

interface FeatureImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

interface UnsplashImage {
  id: string;
  urls: { small: string; regular: string };
  user: { name: string; links: { html: string } };
  links: { html: string };
}

export function FeatureImagePicker({ value, onChange, disabled }: FeatureImagePickerProps) {
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(value);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Unsplash state
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashImages, setUnsplashImages] = useState<UnsplashImage[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);

  useEffect(() => {
    if (open && currentTenant) {
      loadImageDocuments();
    }
  }, [open, currentTenant]);

  useEffect(() => {
    setUrlInput(value);
  }, [value]);

  const loadImageDocuments = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, file_name, file_path, file_type')
        .eq('tenant_id', currentTenant.id)
        .or('file_type.ilike.%image%,file_type.ilike.%png%,file_type.ilike.%jpg%,file_type.ilike.%jpeg%,file_type.ilike.%gif%,file_type.ilike.%webp%')
        .order('created_at', { ascending: false })
        .limit(50);
      setDocuments(data || []);
    } catch (e) {
      console.error('Failed to load image documents:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSelectDocument = (doc: any) => {
    const url = getPublicUrl(doc.file_path);
    onChange(url);
    setOpen(false);
  };

  const handleUrlSubmit = () => {
    onChange(urlInput);
    setOpen(false);
  };

  const searchUnsplash = async () => {
    if (!unsplashQuery.trim()) return;
    setUnsplashLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-unsplash", {
        body: { query: unsplashQuery },
      });
      if (error) throw error;
      setUnsplashImages(data?.results || []);
    } catch (e) {
      console.error("Unsplash search failed:", e);
    } finally {
      setUnsplashLoading(false);
    }
  };

  const handleSelectUnsplash = (img: UnsplashImage) => {
    onChange(img.urls.regular);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label>Titelbild</Label>
      {value && (
        <div className="relative rounded-md overflow-hidden border aspect-video mb-2">
          <img src={value} alt="Titelbild" className="w-full h-full object-cover" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => onChange('')}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-2" disabled={disabled}>
            <Image className="h-4 w-4" />
            {value ? 'Bild ändern' : 'Titelbild wählen'}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Titelbild auswählen</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="unsplash">
            <TabsList className="w-full">
              <TabsTrigger value="unsplash" className="flex-1">Unsplash</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1">Dokumente</TabsTrigger>
              <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
            </TabsList>
            <TabsContent value="unsplash" className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Bilder suchen..."
                  value={unsplashQuery}
                  onChange={(e) => setUnsplashQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
                />
                <Button onClick={searchUnsplash} disabled={unsplashLoading} size="icon" variant="outline">
                  {unsplashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {unsplashImages.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="grid grid-cols-3 gap-2 p-1">
                    {unsplashImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => handleSelectUnsplash(img)}
                        className="border rounded-md overflow-hidden hover:ring-2 ring-primary transition-all aspect-square"
                      >
                        <img src={img.urls.small} alt={`Foto von ${img.user.name}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nach Bildern suchen, um Ergebnisse zu sehen.
                </p>
              )}
            </TabsContent>
            <TabsContent value="documents">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine Bilder in Ihren Dokumenten gefunden.
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="grid grid-cols-3 gap-2 p-1">
                    {documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleSelectDocument(doc)}
                        className="border rounded-md overflow-hidden hover:ring-2 ring-primary transition-all aspect-square"
                      >
                        <img
                          src={getPublicUrl(doc.file_path)}
                          alt={doc.file_name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label>Bild-URL eingeben</Label>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              {urlInput && (
                <div className="border rounded-md overflow-hidden aspect-video">
                  <img src={urlInput} alt="Vorschau" className="w-full h-full object-cover" />
                </div>
              )}
              <Button onClick={handleUrlSubmit} className="w-full">
                URL übernehmen
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

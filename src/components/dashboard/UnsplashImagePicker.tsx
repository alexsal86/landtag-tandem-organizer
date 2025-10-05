import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UnsplashImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageUrl: string, position: "center" | "top" | "bottom") => void;
  currentUrl?: string;
  currentPosition: "center" | "top" | "bottom";
}

interface UnsplashImage {
  id: string;
  urls: {
    small: string;
    regular: string;
  };
  user: {
    name: string;
  };
}

export function UnsplashImagePicker({
  isOpen,
  onClose,
  onSave,
  currentUrl,
  currentPosition,
}: UnsplashImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(currentUrl || null);
  const [position, setPosition] = useState<"center" | "top" | "bottom">(currentPosition);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const searchUnsplash = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=12&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY || ""}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unsplash API error");
      }

      const data = await response.json();
      setImages(data.results || []);
    } catch (error) {
      console.error("Error searching Unsplash:", error);
      toast({
        title: "Suchfehler",
        description: "Die Unsplash-Suche konnte nicht durchgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Bitte wähle eine Bilddatei aus.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Das Bild darf maximal 5MB groß sein.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dashboard-covers")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("dashboard-covers")
        .getPublicUrl(fileName);

      setSelectedImage(publicUrl);
      toast({
        title: "Upload erfolgreich",
        description: "Dein Bild wurde hochgeladen.",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Das Bild konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!selectedImage) {
      toast({
        title: "Kein Bild gewählt",
        description: "Bitte wähle zuerst ein Bild aus.",
        variant: "destructive",
      });
      return;
    }

    onSave(selectedImage, position);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dashboard-Cover auswählen</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="unsplash" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="unsplash">Unsplash durchsuchen</TabsTrigger>
            <TabsTrigger value="upload">Eigenes Bild hochladen</TabsTrigger>
          </TabsList>

          <TabsContent value="unsplash" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Suche nach Bildern..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
              />
              <Button onClick={searchUnsplash} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`cursor-pointer rounded-lg overflow-hidden transition-all hover:scale-105 ${
                      selectedImage === img.urls.regular ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedImage(img.urls.regular)}
                  >
                    <img
                      src={img.urls.small}
                      alt={`Photo by ${img.user.name}`}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isUploading ? "Wird hochgeladen..." : "Klicke hier, um ein Bild hochzuladen"}
                  </p>
                  <p className="text-xs text-muted-foreground">Maximale Größe: 5MB</p>
                </div>
              </label>
            </div>

            {selectedImage && selectedImage.includes("dashboard-covers") && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={selectedImage}
                  alt="Uploaded cover"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bildposition</label>
            <Select value={position} onValueChange={(val: any) => setPosition(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Mitte</SelectItem>
                <SelectItem value="top">Oben</SelectItem>
                <SelectItem value="bottom">Unten</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedImage && (
            <div className="rounded-lg overflow-hidden border">
              <div className="text-xs text-muted-foreground p-2 bg-muted">Vorschau:</div>
              <div className="h-32 overflow-hidden">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition:
                      position === "center" ? "center" : position === "top" ? "top" : "bottom",
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={!selectedImage}>
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

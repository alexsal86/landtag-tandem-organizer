import { useCallback, useEffect, useRef, useState } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
}

export const useCanvasGallery = () => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
  const blobUrlMapRef = useRef<Map<string, string>>(new Map());

  const resolveBlobUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const cached = blobUrlMapRef.current.get(storagePath);
    if (cached) return cached;
    try {
      const { data } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
      if (!data?.publicUrl) return null;
      blobUrlMapRef.current.set(storagePath, data.publicUrl);
      return data.publicUrl;
    } catch { return null; }
  }, []);

  const loadGalleryImages = useCallback(async () => {
    if (!currentTenant?.id) return;
    setGalleryLoading(true);
    try {
      const folderPath = `${currentTenant.id}/header-images`;
      const { data: files, error } = await supabase.storage.from('letter-assets').list(folderPath);
      if (error) return;
      const imageFiles = (files || []).filter((f: Record<string, any>) => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name));
      const loaded: GalleryImage[] = [];
      for (const file of imageFiles) {
        const filePath = `${folderPath}/${file.name}`;
        try {
          const { data: urlData } = supabase.storage.from('letter-assets').getPublicUrl(filePath);
          if (!urlData?.publicUrl) continue;
          blobUrlMapRef.current.set(filePath, urlData.publicUrl);
          loaded.push({ name: file.name, path: filePath, blobUrl: urlData.publicUrl });
        } catch (e) { debugConsole.error('Error downloading', file.name, e); }
      }
      setGalleryImages((previous) => {
        previous.forEach((img) => URL.revokeObjectURL(img.blobUrl));
        return loaded;
      });
    } catch (error) { debugConsole.error('Error loading gallery:', error); }
    finally { setGalleryLoading(false); }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadGalleryImages();
    return () => {
      setGalleryImages((previous) => {
        previous.forEach((img) => URL.revokeObjectURL(img.blobUrl));
        return [];
      });
      blobUrlMapRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlMapRef.current.clear();
    };
  }, [currentTenant?.id, loadGalleryImages]);

  const uploadImage = async (file: File): Promise<{ publicUrl: string; storagePath: string; blobUrl: string } | null> => {
    try {
      if (!currentTenant?.id) { toast({ title: 'Fehler', description: 'Kein Mandant gefunden', variant: 'destructive' }); return null; }
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/header-images/${fileName}`;
      const { data, error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(data.path);
      const blobUrl = URL.createObjectURL(file);
      blobUrlMapRef.current.set(filePath, blobUrl);
      await loadGalleryImages();
      return { publicUrl, storagePath: filePath, blobUrl };
    } catch (error) {
      debugConsole.error('Upload error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
      return null;
    }
  };

  const handleGalleryUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadImage(file);
      toast({ title: 'Bild hochgeladen' });
    };
    input.click();
  };

  const deleteGalleryImage = async (galleryImg: GalleryImage) => {
    try {
      const { error } = await supabase.storage.from('letter-assets').remove([galleryImg.path]);
      if (error) { toast({ title: 'Fehler', description: `Löschen fehlgeschlagen: ${error.message}`, variant: 'destructive' }); return; }
      URL.revokeObjectURL(galleryImg.blobUrl);
      blobUrlMapRef.current.delete(galleryImg.path);
      await loadGalleryImages();
      toast({ title: 'Bild gelöscht' });
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: `Bild konnte nicht gelöscht werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`, variant: 'destructive' });
    }
  };

  return {
    galleryImages,
    galleryLoading,
    selectedGalleryImage,
    setSelectedGalleryImage,
    blobUrlMapRef,
    resolveBlobUrl,
    uploadImage,
    handleGalleryUpload,
    deleteGalleryImage,
    loadGalleryImages,
  };
};

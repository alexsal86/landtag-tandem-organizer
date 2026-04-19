import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";

export interface SocialAsset {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  tags: string[];
  width: number | null;
  height: number | null;
  created_at: string;
  public_url: string;
}

const BUCKET = "documents";

export function useSocialAssets() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
  const [assets, setAssets] = useState<SocialAsset[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) {
      setAssets([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("social_assets")
        .select("id, storage_path, file_name, mime_type, file_size, tags, width, height, created_at")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      setAssets(
        (data || []).map((row) => ({
          ...row,
          tags: row.tags || [],
          public_url: supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
        })) as SocialAsset[],
      );
    } catch (error) {
      console.error("Error loading social assets:", getErrorMessage(error), error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, user?.id]);

  const uploadAsset = useCallback(
    async (file: File, tags: string[] = []) => {
      if (!user?.id || !currentTenant?.id || !profileId) throw new Error("not-authenticated");
      const ext = file.name.split(".").pop() || "bin";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const storagePath = `${user.id}/social-assets/${safeName}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("social_assets").insert({
        tenant_id: currentTenant.id,
        uploaded_by: profileId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        tags,
      });
      if (insertError) throw insertError;
      await load();
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      return data.publicUrl;
    },
    [currentTenant?.id, load, profileId, user?.id],
  );

  const updateTags = useCallback(
    async (id: string, tags: string[]) => {
      if (!currentTenant?.id) return;
      const { error } = await supabase
        .from("social_assets")
        .update({ tags })
        .eq("id", id)
        .eq("tenant_id", currentTenant.id);
      if (error) throw new Error(getErrorMessage(error));
      await load();
    },
    [currentTenant?.id, load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const allTags = useMemo(() => {
    return Array.from(new Set(assets.flatMap((a) => a.tags))).sort();
  }, [assets]);

  return useMemo(
    () => ({ assets, loading, allTags, load, uploadAsset, updateTags }),
    [assets, loading, allTags, load, uploadAsset, updateTags],
  );
}

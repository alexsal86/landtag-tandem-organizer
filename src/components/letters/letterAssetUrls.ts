import { supabase } from '@/integrations/supabase/client';

export const getLetterAssetPublicUrl = (storagePath?: string | null): string | null => {
  if (!storagePath) return null;
  const { data } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
  return data?.publicUrl || null;
};

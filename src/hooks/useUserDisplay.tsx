import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserDisplay {
  display_name: string | null;
  avatar_url: string | null;
}

const cache = new Map<string, UserDisplay>();

export function useUserDisplay(userId: string | null | undefined) {
  const [user, setUser] = useState<UserDisplay | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }

    if (cache.has(userId)) {
      setUser(cache.get(userId)!);
      return;
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        const display: UserDisplay = {
          display_name: data?.display_name || null,
          avatar_url: data?.avatar_url || null,
        };
        cache.set(userId, display);
        setUser(display);
        setLoading(false);
      });
  }, [userId]);

  return { user, loading };
}

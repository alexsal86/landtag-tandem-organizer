import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

/**
 * Returns the `profiles.id` for the current user + tenant combination.
 * This is needed because many tables have `created_by` FK referencing `profiles.id`,
 * which is NOT the same as `auth.users.id`.
 */
export function useCurrentProfileId() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !currentTenant?.id) {
      setProfileId(null);
      return;
    }

    supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", currentTenant.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[useCurrentProfileId]', error.message);
          return;
        }
        setProfileId(data?.id ?? null);
      });
  }, [user?.id, currentTenant?.id]);

  return profileId;
}

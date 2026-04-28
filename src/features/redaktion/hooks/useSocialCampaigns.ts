import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { getErrorMessage } from "@/utils/errorHandler";

export type SocialCampaignStatus = "draft" | "active" | "completed" | "paused";

export interface SocialCampaign {
  id: string;
  name: string;
  objective: string | null;
  target_audience: string | null;
  message_house: string | null;
  start_date: string | null;
  end_date: string | null;
  owner_id: string | null;
  status: SocialCampaignStatus;
}

function normalizeStatus(status: string | null | undefined): SocialCampaignStatus {
  switch (status) {
    case "active":
    case "completed":
    case "paused":
    case "draft":
      return status;
    default:
      return "draft";
  }
}

export function useSocialCampaigns() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCampaigns = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("social_campaigns")
        .select("id, name, objective, target_audience, message_house, start_date, end_date, owner_id, status")
        .eq("tenant_id", currentTenant.id)
        .order("start_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns((data || []).map((row: Record<string, any>) => ({ ...row, status: normalizeStatus(row.status) })));
    } catch (error) {
      console.error("Error loading social campaigns:", getErrorMessage(error), error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, user?.id]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  return { campaigns, loading, loadCampaigns };
}

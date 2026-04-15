import { useState, useEffect, useCallback } from "react";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";

interface Contact {
  id: string;
  name: string;
  contact_type: "person" | "organization" | "archive";
  organization?: string | null;
  email?: string | null;
  tags?: string[] | null;
}

const PAGE_SIZE = 500;
const STAKEHOLDER_SELECT = "id, contact_type, name, organization, email, tags";

type MinimalStakeholder = Contact;

const mapStakeholder = (contact: MinimalStakeholder): Contact => ({
  id: contact.id,
  contact_type: contact.contact_type,
  name: contact.name,
  organization: contact.organization ?? null,
  email: contact.email ?? null,
  tags: contact.tags ?? [],
});

export const useStakeholderPreload = (searchTerm?: string) => {
  const [stakeholders, setStakeholders] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const buildStakeholderSearch = useCallback((term: string) => {
    const escapedTerm = term.replace(/[%_,]/g, (char) => `\\${char}`);
    const exactTagTerm = term.replace(/["{}]/g, "").trim();
    const wildcardTerm = `%${escapedTerm}%`;

    const searchFilters = [
      `name.ilike.${wildcardTerm}`,
      `email.ilike.${wildcardTerm}`,
    ];

    if (exactTagTerm) {
      searchFilters.push(`tags.cs.{"${exactTagTerm}"}`);
    }

    return searchFilters.join(",");
  }, []);

  const fetchStakeholders = useCallback(async () => {
    if (!user || !currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allStakeholders: Contact[] = [];
      let from = 0;
      const normalizedSearch = searchTerm?.trim();

      while (true) {
        const to = from + PAGE_SIZE - 1;
        let query = supabase
          .from("contacts")
          .select(STAKEHOLDER_SELECT)
          .eq("tenant_id", currentTenant.id)
          .eq("contact_type", "organization")
          .order("name", { ascending: true })
          .range(from, to);

        if (normalizedSearch) {
          query = query.or(buildStakeholderSearch(normalizedSearch));
        }

        const { data, error } = await query;

        if (error) {
          debugConsole.error("Error fetching stakeholders:", error);
          return;
        }

        const pageStakeholders = (data || []).map((d: any) => mapStakeholder(d));
        allStakeholders.push(...pageStakeholders);

        if (!data || data.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      setStakeholders(allStakeholders);
    } catch (error) {
      debugConsole.error("Error in fetchStakeholders:", error);
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant, searchTerm, buildStakeholderSearch]);

  const upsertStakeholderById = useCallback(
    async (contactId: string) => {
      if (!currentTenant) return;

      let query = supabase
        .from("contacts")
        .select(STAKEHOLDER_SELECT)
        .eq("tenant_id", currentTenant.id)
        .eq("id", contactId)
        .eq("contact_type", "organization");

      const normalizedSearch = searchTerm?.trim();
      if (normalizedSearch) {
        query = query.or(buildStakeholderSearch(normalizedSearch));
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        debugConsole.error("Error refreshing stakeholder by id:", error);
        return;
      }

      setStakeholders((prev) => {
        const next = prev.filter((stakeholder) => stakeholder.id !== contactId);
        if (!data) {
          return next;
        }

        next.push(mapStakeholder(data as MinimalStakeholder));
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    [currentTenant, searchTerm, buildStakeholderSearch]
  );

  useEffect(() => {
    fetchStakeholders();
  }, [fetchStakeholders]);

  useEffect(() => {
    if (!user || !currentTenant) return;

    const channel = supabase
      .channel(`stakeholder-changes-${currentTenant.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
          filter: `tenant_id=eq.${currentTenant.id},contact_type=eq.organization`,
        },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          const changedId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (!changedId) return;

          if (payload.eventType === "DELETE") {
            setStakeholders((prev) => prev.filter((stakeholder) => stakeholder.id !== changedId));
            return;
          }

          upsertStakeholderById(changedId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTenant, upsertStakeholderById]);

  return {
    stakeholders,
    loading,
    refreshStakeholders: fetchStakeholders,
  };
};

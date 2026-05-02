import { useState, useEffect, useCallback } from "react";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Contact } from "@/hooks/useInfiniteContacts";
import { debugConsole } from '@/utils/debugConsole';
import { handleAppError } from '@/utils/errorHandler';

const PAGE_SIZE = 500;
const PERSON_CONTACT_SELECT = "id, contact_type, name, organization, organization_id, email";

type MinimalPersonContact = Pick<Contact, "id" | "contact_type" | "name" | "organization" | "organization_id" | "email">;

const mapPersonContact = (contact: MinimalPersonContact): Contact => ({
  id: contact.id,
  contact_type: contact.contact_type,
  name: contact.name,
  organization: contact.organization ?? undefined,
  organization_id: contact.organization_id ?? undefined,
  email: contact.email ?? undefined,
});

export const useAllPersonContacts = () => {
  const [personContacts, setPersonContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const fetchPersonContacts = useCallback(async () => {
    if (!user || !currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allContacts: Contact[] = [];
      let from = 0;

      while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data: contacts, error } = await supabase
          .from("contacts")
          .select(PERSON_CONTACT_SELECT)
          .eq("tenant_id", currentTenant.id)
          .eq("contact_type", "person")
          .neq("name", "Archivierter Kontakt")
          .order("name")
          .range(from, to);

        if (error) {
          debugConsole.error("Error fetching person contacts:", error);
          return;
        }

        const pageContacts = (contacts || []).map((c) => mapPersonContact(c as Parameters<typeof mapPersonContact>[0]));
        allContacts.push(...pageContacts);

        if (!contacts || contacts.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      setPersonContacts(allContacts);
    } catch (error) {
      handleAppError(error, { context: 'useAllPersonContacts.fetch' });
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant]);

  const upsertContactById = useCallback(
    async (contactId: string) => {
      if (!currentTenant) return;

      const { data, error } = await supabase
        .from("contacts")
        .select(PERSON_CONTACT_SELECT)
        .eq("tenant_id", currentTenant.id)
        .eq("id", contactId)
        .eq("contact_type", "person")
        .neq("name", "Archivierter Kontakt")
        .maybeSingle();

      if (error) {
        debugConsole.error("Error refreshing person contact by id:", error);
        return;
      }

      setPersonContacts((prev) => {
        const next = prev.filter((contact) => contact.id !== contactId);
        if (!data) {
          return next;
        }

        next.push(mapPersonContact(data as MinimalPersonContact));
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    [currentTenant]
  );

  useEffect(() => {
    fetchPersonContacts();
  }, [fetchPersonContacts]);

  useEffect(() => {
    if (!user || !currentTenant) return;

    const contactsChannel = supabase
      .channel("person-contacts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts",
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          const changedId = (payload.new as { id?: string } | null)?.id || (payload.old as { id?: string } | null)?.id;
          if (!changedId) return;

          if (payload.eventType === "DELETE") {
            setPersonContacts((prev) => prev.filter((contact) => contact.id !== changedId));
            return;
          }

          upsertContactById(changedId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
    };
  }, [user, currentTenant, upsertContactById]);

  return {
    personContacts,
    loading,
    refreshPersonContacts: fetchPersonContacts,
  };
};

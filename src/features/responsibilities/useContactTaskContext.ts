import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

/** Validate the contact in the current tenant before reading its topic links. */
export function useContactTaskContext(contactId: string | null) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["contact-task-context", currentTenant?.id, contactId],
    enabled: !!contactId && !!currentTenant?.id,
    queryFn: async () => {
      if (!contactId || !currentTenant)
        throw new Error("Kein Kontakt ausgewählt.");
      const contact = await supabase
        .from("contacts")
        .select("id,name")
        .eq("id", contactId)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      if (contact.error) throw contact.error;
      if (!contact.data)
        throw new Error("Kontakt gehört nicht zum ausgewählten Büro.");
      const links = await supabase
        .from("contact_topics")
        .select("topic_id")
        .eq("contact_id", contactId);
      if (links.error) throw links.error;
      const ids = (links.data ?? []).map((l) => l.topic_id);
      const topics = ids.length
        ? await supabase
            .from("topics")
            .select("id")
            .eq("tenant_id", currentTenant.id)
            .in("id", ids)
        : { data: [], error: null };
      if (topics.error) throw topics.error;
      return {
        ...contact.data,
        topicIds: (topics.data ?? []).map((t) => t.id),
      };
    },
  });
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from '@/utils/debugConsole';

interface DocumentCounts {
  [contactId: string]: {
    direct: number;
    tagged: number;
    total: number;
  };
}

export const useContactDocumentCounts = (contactIds: string[]) => {
  const [counts, setCounts] = useState<DocumentCounts>({});
  const [loading, setLoading] = useState(false);
  const { currentTenant } = useTenant();

  useEffect(() => {
    const fetchCounts = async () => {
      if (!contactIds.length || !currentTenant?.id) {
        setCounts({});
        return;
      }

      setLoading(true);
      try {
        // Bulk query for direct links with tenant_id filter via JOIN
        const { data: directData, error: directError } = await supabase
          .from('document_contacts')
          .select('contact_id, document_id, document:documents!inner(tenant_id)')
          .in('contact_id', contactIds)
          .eq('document.tenant_id', currentTenant.id);

        if (directError) throw directError;

        // Count direct documents per contact
        const directCounts: Record<string, number> = {};
        directData?.forEach(d(c: Record<string, any>) => {
          directCounts[dc.contact_id] = (directCounts[dc.contact_id] || 0) + 1;
        });

        // For tag-based: Get all contact tags + documents with matching tags
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, tags')
          .in('id', contactIds);

        const taggedCounts: Record<string, number> = {};

        const contactsWithTags = (contactsData || []).filter(c: Record<string, any> => c.tags && c.tags.length > 0);

        if (contactsWithTags.length > 0) {
          // Alle einzigartigen Tags aller Kontakte ermitteln
          const allContactTags = Array.from(new Set(contactsWithTags.flatMap(c: Record<string, any> => c.tags as string[])));

          // Nur Dokumente laden, deren Tags sich mit einem der Kontakt-Tags überschneiden (DB-seitig)
          const { data: taggedDocs, error: taggedError } = await supabase
            .from('documents')
            .select('id, tags')
            .eq('tenant_id', currentTenant.id)
            .overlaps('tags', allContactTags);

          if (taggedError) throw taggedError;

          // Treffer pro Kontakt zählen (bereits stark reduziertes Ergebnis-Set)
          contactsWithTags.forEach(c(ontact: Record<string, any>) => {
            const contactTags = contact.tags as string[];
            const matchingDocs = taggedDocs?.filter(d(oc: Record<string, any>) =>
              doc.tags && (doc.tags as string[]).some(tag => contactTags.includes(tag))
            ) || [];

            // Dokumente ausschließen, die bereits über directData gezählt wurden
            const uniqueMatches = matchingDocs.filter(d(oc: Record<string, any>) =>
              !directData?.some(d(c: Record<string, any>) => dc.document_id === doc.id && dc.contact_id === contact.id)
            );

            taggedCounts[contact.id] = uniqueMatches.length;
          });
        }

        // Combine results
        const finalCounts: DocumentCounts = {};
        contactIds.forEach(id => {
          const direct = directCounts[id] || 0;
          const tagged = taggedCounts[id] || 0;
          finalCounts[id] = {
            direct,
            tagged,
            total: direct + tagged,
          };
        });

        setCounts(finalCounts);
      } catch (error) {
        debugConsole.error('Error fetching document counts:', error);
        setCounts({});
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [contactIds.join(','), currentTenant?.id]);

  return { counts, loading };
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

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
        directData?.forEach(dc => {
          directCounts[dc.contact_id] = (directCounts[dc.contact_id] || 0) + 1;
        });

        // For tag-based: Get all contact tags + documents with matching tags
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, tags')
          .in('id', contactIds);

        const taggedCounts: Record<string, number> = {};
        
        // Batch tag queries to avoid too many individual requests
        const contactsWithTags = (contactsData || []).filter(c => c.tags && c.tags.length > 0);
        
        if (contactsWithTags.length > 0) {
          // Get all unique tags
          const allTags = Array.from(new Set(contactsWithTags.flatMap(c => c.tags)));
          
          // Fetch all documents with any of these tags in one query
          const { data: taggedDocs } = await supabase
            .from('documents')
            .select('id, tags')
            .eq('tenant_id', currentTenant.id)
            .not('tags', 'is', null);

          // Count matches for each contact
          contactsWithTags.forEach(contact => {
            const matchingDocs = taggedDocs?.filter(doc => 
              doc.tags && doc.tags.some((tag: string) => contact.tags.includes(tag))
            ) || [];
            
            // Exclude documents already counted in direct links
            const uniqueMatches = matchingDocs.filter(doc => 
              !directData?.some(dc => dc.document_id === doc.id && dc.contact_id === contact.id)
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
        console.error('Error fetching document counts:', error);
        setCounts({});
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [contactIds.join(','), currentTenant?.id]);

  return { counts, loading };
};

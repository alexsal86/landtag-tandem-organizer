import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface Contact {
  id: string;
  name: string;
  contact_type: "person" | "organization" | "archive";
  role?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  address?: string | null;
  birthday?: string | null;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  xing?: string | null;
  category?: "citizen" | "colleague" | "business" | "media" | "organization" | "government" | "ngo" | "academia" | "healthcare" | "legal" | "other" | "lobbyist" | null;
  priority?: "low" | "medium" | "high" | null;
  last_contact?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  additional_info?: string | null;
  legal_form?: string | null;
  tax_number?: string | null;
  vat_number?: string | null;
  commercial_register_number?: string | null;
  industry?: string | null;
  company_size?: string | null;
  annual_revenue?: string | null;
  business_description?: string | null;
  main_contact_person?: string | null;
  is_favorite?: boolean | null;
  tags?: string[] | null;
}

export const useStakeholderPreload = (searchTerm?: string) => {
  const [stakeholders, setStakeholders] = useState<Contact[]>([]);
  const [filteredStakeholders, setFilteredStakeholders] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const fetchStakeholders = async () => {
    if (!user || !currentTenant) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('contact_type', 'organization')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching stakeholders:', error);
        return;
      }

      const formattedStakeholders = data?.map(contact => ({
        id: contact.id,
        contact_type: (contact.contact_type as "person" | "organization" | "archive") || "organization",
        name: contact.name,
        role: contact.role,
        organization: contact.organization,
        organization_id: contact.organization_id,
        email: contact.email,
        phone: contact.phone,
        location: contact.location,
        address: contact.address,
        birthday: contact.birthday,
        website: contact.website,
        linkedin: contact.linkedin,
        twitter: contact.twitter,
        facebook: contact.facebook,
        instagram: contact.instagram,
        xing: contact.xing,
        category: contact.category as Contact["category"],
        priority: contact.priority as Contact["priority"],
        last_contact: contact.last_contact,
        avatar_url: contact.avatar_url,
        notes: contact.notes,
        additional_info: contact.additional_info,
        legal_form: contact.legal_form,
        tax_number: contact.tax_number,
        vat_number: contact.vat_number,
        commercial_register_number: contact.commercial_register_number,
        industry: contact.industry,
        company_size: contact.company_size,
        annual_revenue: contact.annual_revenue,
        business_description: contact.business_description,
        main_contact_person: contact.main_contact_person,
        is_favorite: contact.is_favorite || false,
        tags: contact.tags || [],
      })) || [];

      setStakeholders(formattedStakeholders);
      setFilteredStakeholders(formattedStakeholders);
    } catch (error) {
      console.error('Error in fetchStakeholders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStakeholders();
  }, [user, currentTenant]);

  // Listen for changes to stakeholders
  useEffect(() => {
    if (!user || !currentTenant) return;

    const channel = supabase
      .channel('stakeholder-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `tenant_id=eq.${currentTenant.id},contact_type=eq.organization`,
        },
        () => {
          fetchStakeholders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTenant]);

  // Filter stakeholders based on search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      setFilteredStakeholders(stakeholders);
    } else {
      const searchLower = searchTerm.toLowerCase().trim();
      const filtered = stakeholders.filter(stakeholder => 
        stakeholder.name.toLowerCase().includes(searchLower) ||
        (stakeholder.industry && stakeholder.industry.toLowerCase().includes(searchLower)) ||
        (stakeholder.business_description && stakeholder.business_description.toLowerCase().includes(searchLower)) ||
        (stakeholder.main_contact_person && stakeholder.main_contact_person.toLowerCase().includes(searchLower)) ||
        (stakeholder.email && stakeholder.email.toLowerCase().includes(searchLower)) ||
        (stakeholder.tags && stakeholder.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
      setFilteredStakeholders(filtered);
    }
  }, [searchTerm, stakeholders]);

  return { 
    stakeholders: filteredStakeholders, 
    loading, 
    refreshStakeholders: fetchStakeholders 
  };
};
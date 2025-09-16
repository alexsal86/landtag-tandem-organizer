import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PartyAssociation {
  id: string;
  tenant_id: string;
  name: string;
  party_name: string;
  party_type: string;
  phone?: string;
  website?: string;
  email?: string;
  social_media?: any;
  address_street?: string;
  address_number?: string;
  address_postal_code?: string;
  address_city?: string;
  full_address?: string;
  coverage_areas?: any;
  administrative_boundaries?: any;
  contact_info?: any;
  created_at: string;
  updated_at: string;
}

export function usePartyAssociations() {
  const [associations, setAssociations] = useState<PartyAssociation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssociations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('party_associations')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching party associations:', error);
        toast.error('Fehler beim Laden der Partei-Verbände');
        return;
      }

      setAssociations(data || []);
    } catch (error) {
      console.error('Error in fetchAssociations:', error);
      toast.error('Fehler beim Laden der Partei-Verbände');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssociations();
  }, []);

  const refetch = () => {
    fetchAssociations();
  };

  return {
    associations,
    loading,
    refetch
  };
}
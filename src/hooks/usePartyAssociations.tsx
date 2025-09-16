import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Import ElectionDistrict type
import type { ElectionDistrict } from './useElectionDistricts';

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
  // Populated from administrative_boundaries lookup
  boundary_districts?: ElectionDistrict[];
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

      // Fetch linked administrative boundary districts
      const associationsWithBoundaries = await Promise.all(
        (data || []).map(async (association) => {
          const boundaries = association.administrative_boundaries;
          if (boundaries && Array.isArray(boundaries) && boundaries.length > 0) {
            const { data: boundaryDistricts, error: boundaryError } = await supabase
              .from('election_districts')
              .select('*')
              .in('id', boundaries as string[]);

            if (boundaryError) {
              console.error('Error fetching boundary districts:', boundaryError);
              return association;
            }

            return {
              ...association,
              boundary_districts: boundaryDistricts || []
            };
          }
          return association;
        })
      );

      setAssociations(associationsWithBoundaries);
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
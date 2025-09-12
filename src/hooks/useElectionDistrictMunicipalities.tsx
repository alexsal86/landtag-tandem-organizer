import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ElectionDistrictMunicipality {
  id: string;
  district_id: string;
  name: string;
  type: 'municipality' | 'city' | 'county' | 'city_district';
  county?: string;
  created_at: string;
  updated_at: string;
}

export const useElectionDistrictMunicipalities = (districtId?: string) => {
  const [municipalities, setMunicipalities] = useState<ElectionDistrictMunicipality[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMunicipalities = async () => {
    if (!districtId) {
      setMunicipalities([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('election_district_municipalities')
        .select('*')
        .eq('district_id', districtId)
        .order('name');

      if (fetchError) {
        throw fetchError;
      }

      setMunicipalities((data || []) as ElectionDistrictMunicipality[]);
    } catch (err) {
      console.error('Error fetching municipalities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch municipalities');
      setMunicipalities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMunicipalities();
  }, [districtId]);

  return {
    municipalities,
    loading,
    error,
    refetch: fetchMunicipalities
  };
};
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export interface KarlsruheDistrict {
  id: string;
  name: string;
  boundaries: any;
  center_coordinates: { lat: number; lng: number };
  color: string;
  area_km2?: number;
  population?: number;
  is_city_boundary?: boolean;
  created_at: string;
  updated_at: string;
}

export const useKarlsruheDistricts = () => {
  const [isFetching, setIsFetching] = useState(false);

  const { data: districts, isLoading, error, refetch } = useQuery({
    queryKey: ['karlsruhe-districts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('karlsruhe_districts')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as KarlsruheDistrict[];
    },
  });

  // Auto-fetch from Overpass API if no data exists
  useEffect(() => {
    const fetchFromOverpass = async () => {
      if (!isLoading && districts && districts.length === 0 && !isFetching) {
        setIsFetching(true);
        console.log('No districts found, fetching from Overpass API...');

        try {
          const { error: functionError } = await supabase.functions.invoke(
            'fetch-karlsruhe-districts'
          );

          if (functionError) {
            console.error('Error fetching districts:', functionError);
          } else {
            console.log('Districts fetched successfully');
            // Refetch the data
            await refetch();
          }
        } catch (err) {
          console.error('Error invoking edge function:', err);
        } finally {
          setIsFetching(false);
        }
      }
    };

    fetchFromOverpass();
  }, [isLoading, districts, isFetching, refetch]);

  return {
    districts: districts || [],
    isLoading: isLoading || isFetching,
    error,
    refetch: async () => {
      setIsFetching(true);
      try {
        await supabase.functions.invoke('fetch-karlsruhe-districts');
        await refetch();
      } finally {
        setIsFetching(false);
      }
    },
  };
};

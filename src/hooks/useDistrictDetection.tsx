import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DistrictDetectionResult {
  coordinates: { lat: number; lng: number };
  district?: {
    id: string;
    district_name: string;
    district_number: number;
  };
  partyAssociation?: {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    website?: string;
    email?: string;
  };
}

export const useDistrictDetection = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DistrictDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectDistrict = useCallback(async (
    location?: string, 
    coordinates?: { lat: number; lng: number }
  ) => {
    if (!location && !coordinates) {
      setError('Either location or coordinates must be provided');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Detecting district for:', { location, coordinates });

      const { data, error: functionError } = await supabase.functions.invoke('detect-appointment-district', {
        body: { location, coordinates }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message || 'Failed to detect district');
      }

      if (data?.error) {
        console.error('Detection error:', data.error);
        setError(data.error);
        return null;
      }

      console.log('Detection result:', data);
      setResult(data);
      return data;

    } catch (err) {
      console.error('Error detecting district:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    detectDistrict,
    clearResult,
    loading,
    result,
    error
  };
};
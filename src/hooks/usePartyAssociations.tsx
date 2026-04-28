import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { debugConsole } from '@/utils/debugConsole';
import { isRecord } from '@/utils/typeSafety';
import {
  type AssociationFeature,
  type GeoContactInfo,
  normalizeContactInfo,
  normalizeStringArray,
} from './geoContracts';

// Import ElectionDistrict type
import type { ElectionDistrict } from './useElectionDistricts';

export interface PartyAssociation {
  id: string;
  tenant_id: string;
  name: string;
  party_name: string;
  party_type: string;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  social_media?: GeoContactInfo | null;
  address_street?: string | null;
  address_number?: string | null;
  address_postal_code?: string | null;
  address_city?: string | null;
  full_address?: string | null;
  coverage_areas?: AssociationFeature[] | null;
  administrative_boundaries?: string[] | null;
  contact_info?: GeoContactInfo | null;
  created_at: string;
  updated_at: string;
  boundary_districts?: ElectionDistrict[];
}

export function usePartyAssociations() {
  const [associations, setAssociations] = useState<PartyAssociation[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizeAssociation = (value: unknown): PartyAssociation | null => {
    if (!isRecord(value)) {
      return null;
    }

    const { id, tenant_id, name, party_name, party_type, created_at, updated_at } = value;
    if (
      typeof id !== 'string' ||
      typeof tenant_id !== 'string' ||
      typeof name !== 'string' ||
      typeof party_name !== 'string' ||
      typeof party_type !== 'string' ||
      typeof created_at !== 'string' ||
      typeof updated_at !== 'string'
    ) {
      return null;
    }

    const coverageAreas = Array.isArray(value.coverage_areas)
      ? value.coverage_areas.filter((feature): feature is AssociationFeature => isRecord(feature))
      : null;

    return {
      id,
      tenant_id,
      name,
      party_name,
      party_type,
      phone: typeof value.phone === 'string' ? value.phone : null,
      website: typeof value.website === 'string' ? value.website : null,
      email: typeof value.email === 'string' ? value.email : null,
      social_media: normalizeContactInfo(value.social_media),
      address_street: typeof value.address_street === 'string' ? value.address_street : null,
      address_number: typeof value.address_number === 'string' ? value.address_number : null,
      address_postal_code: typeof value.address_postal_code === 'string' ? value.address_postal_code : null,
      address_city: typeof value.address_city === 'string' ? value.address_city : null,
      full_address: typeof value.full_address === 'string' ? value.full_address : null,
      coverage_areas: coverageAreas,
      administrative_boundaries: normalizeStringArray(value.administrative_boundaries),
      contact_info: normalizeContactInfo(value.contact_info),
      created_at,
      updated_at,
    };
  };

  const fetchAssociations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('party_associations')
        .select('id, name, party_name, party_type, email, phone, website, address_street, address_number, address_postal_code, address_city, full_address, administrative_boundaries, coverage_areas, social_media, contact_info, tenant_id, created_at, updated_at')
        .order('name');

      if (error) {
        debugConsole.error('Error fetching party associations:', error);
        toast.error('Fehler beim Laden der Partei-Verbände');
        return;
      }

      const normalizedAssociations = (data ?? [])
        .map((association: Record<string, any>) => normalizeAssociation(association as unknown))
        .filter((association: Record<string, any>): association is PartyAssociation => association !== null);

      const associationsWithBoundaries = await Promise.all(
        normalizedAssociations.map(async (association: Record<string, any>) => {
          const boundaries = association.administrative_boundaries;
          if (boundaries && Array.isArray(boundaries) && boundaries.length > 0) {
            const { data: boundaryDistricts, error: boundaryError } = await supabase
              .from('election_districts')
              .select('id, district_name, district_type, region')
              .in('id', boundaries);

            if (boundaryError) {
              debugConsole.error('Error fetching boundary districts:', boundaryError);
              return association;
            }

            return {
              ...association,
              boundary_districts: (boundaryDistricts as ElectionDistrict[]) || []
            };
          }
          return association;
        })
      );

      setAssociations(associationsWithBoundaries);
    } catch (error) {
      debugConsole.error('Error in fetchAssociations:', error);
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

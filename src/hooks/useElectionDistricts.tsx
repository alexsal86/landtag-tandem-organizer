import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useTenant } from "./useTenant";
import { useToast } from "@/components/ui/use-toast";
import { loadElectoralDistrictsGeoJson } from "@/utils/geoJsonLoader";

interface ElectionRepresentative {
  id: string;
  name: string;
  party: string;
  mandate_type: 'direct' | 'list';
  order_index: number;
  email?: string;
  phone?: string;
  office_address?: string;
  bio?: string;
}

export interface ElectionDistrict {
  id: string;
  district_number: number;
  district_name: string;
  region: string;
  boundaries?: any;
  center_coordinates?: any;
  population?: number;
  area_km2?: number;
  contact_info?: any;
  website_url?: string;
  district_type?: string;
  major_cities?: string[];
  rural_percentage?: number;
  representatives?: ElectionRepresentative[];
  created_at: string;
  updated_at: string;
}

export interface ElectionDistrictNote {
  id: string;
  user_id: string;
  tenant_id: string;
  district_id: string;
  title: string;
  content?: string;
  priority: string;
  category: string;
  due_date?: string;
  is_completed: boolean;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export function useElectionDistricts() {
  const [districts, setDistricts] = useState<ElectionDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDistricts = async () => {
    const buildCentroid = (geometry: any): { lat: number; lng: number } => {
      try {
        let pts: number[][] = [];
        if (geometry?.type === 'Polygon') {
          pts = geometry.coordinates?.[0] || [];
        } else if (geometry?.type === 'MultiPolygon') {
          pts = geometry.coordinates?.[0]?.[0] || [];
        }
        if (!pts.length) return { lat: 48.7758, lng: 9.1829 };
        const n = pts.length;
        const avgLon = pts.reduce((s, [lon]) => s + lon, 0) / n;
        const avgLat = pts.reduce((s, [, lat]) => s + lat, 0) / n;
        return { lat: avgLat, lng: avgLon };
      } catch {
        return { lat: 48.7758, lng: 9.1829 };
      }
    };

    const loadFromGeoJsonFallback = async () => {
      try {
        console.log('Falling back to public GeoJSON...');
        const fc = await loadElectoralDistrictsGeoJson();
        const now = new Date().toISOString();
        const mapped = (fc.features || []).map((f: any, idx: number) => {
          const num = parseInt(
            String(
              f.properties?.Nummer ?? f.properties?.NR ?? f.properties?.WKR_NR ?? f.properties?.WK_NR ?? f.properties?.WKR ?? idx + 1
            ),
            10
          );
          const name = (f.properties?.['WK Name'] || f.properties?.name || `Wahlkreis ${num}`) as string;
          const centroid = buildCentroid(f.geometry);
          return {
            id: `${num}`,
            district_number: num,
            district_name: name,
            region: 'Baden-Württemberg',
            district_type: 'wahlkreis',
            boundaries: f.geometry, // Already reprojected to WGS84 by loader
            center_coordinates: centroid,
            created_at: now,
            updated_at: now,
          } as ElectionDistrict;
        }).sort((a: any, b: any) => a.district_number - b.district_number);

        console.log('Loaded districts from GeoJSON:', mapped.length);
        setDistricts(mapped as any);
      } catch (e) {
        console.error('GeoJSON fallback failed:', e);
        setDistricts([]);
      }
    };

    try {
      setLoading(true);
      console.log('Fetching election districts from Supabase...');
      
      const { data, error } = await supabase
        .from("election_districts")
        .select(`
          *,
          representatives:election_representatives(
            id,
            name,
            party,
            mandate_type,
            order_index,
            email,
            phone,
            office_address,
            bio
          )
        `)
        .order("district_number");

      if (error) {
        console.warn('Supabase error, using fallback:', error);
        await loadFromGeoJsonFallback();
        return;
      }
      
      console.log('Fetched districts from DB:', data?.length || 0);
      
      if (!data || data.length === 0) {
        await loadFromGeoJsonFallback();
        return;
      }
      
      // Sort representatives within each district and fix types
      const processedData = data.map(district => ({
        ...district,
        representatives: district.representatives?.sort((a: any, b: any) => {
          // Direct mandates first, then by order_index
          if (a.mandate_type === 'direct' && b.mandate_type !== 'direct') return -1;
          if (a.mandate_type !== 'direct' && b.mandate_type === 'direct') return 1;
          return a.order_index - b.order_index;
        })
      })) as ElectionDistrict[];

      console.log('Processed districts:', processedData.length);
      setDistricts(processedData);
    } catch (error) {
      console.error("Error fetching election districts, using fallback:", error);
      await loadFromGeoJsonFallback();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  return {
    districts,
    loading,
    refetch: fetchDistricts,
  };
}

export function useElectionDistrictNotes(districtId?: string) {
  const [notes, setNotes] = useState<ElectionDistrictNote[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const fetchNotes = async () => {
    if (!districtId || !user || !currentTenant) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("election_district_notes")
        .select("*")
        .eq("district_id", districtId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching district notes:", error);
      toast({
        title: "Fehler beim Laden der Notizen",
        description: "Die Notizen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (noteData: {
    district_id: string;
    title: string;
    content?: string;
    priority: string;
    category: string;
    due_date?: string;
    is_completed: boolean;
  }) => {
    if (!user || !currentTenant) return;

    try {
      const { data, error } = await supabase
        .from("election_district_notes")
        .insert({
          ...noteData,
          user_id: user.id,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setNotes(prev => [data, ...prev]);
      toast({
        title: "Notiz erstellt",
        description: "Die Notiz wurde erfolgreich erstellt.",
      });
      
      return data;
    } catch (error) {
      console.error("Error creating note:", error);
      toast({
        title: "Fehler beim Erstellen der Notiz",
        description: "Die Notiz konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const updateNote = async (noteId: string, updates: Partial<ElectionDistrictNote>) => {
    try {
      const { data, error } = await supabase
        .from("election_district_notes")
        .update(updates)
        .eq("id", noteId)
        .select()
        .single();

      if (error) throw error;
      
      setNotes(prev => prev.map(note => note.id === noteId ? data : note));
      toast({
        title: "Notiz aktualisiert",
        description: "Die Notiz wurde erfolgreich aktualisiert.",
      });
      
      return data;
    } catch (error) {
      console.error("Error updating note:", error);
      toast({
        title: "Fehler beim Aktualisieren der Notiz",
        description: "Die Notiz konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("election_district_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      
      setNotes(prev => prev.filter(note => note.id !== noteId));
      toast({
        title: "Notiz gelöscht",
        description: "Die Notiz wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Fehler beim Löschen der Notiz",
        description: "Die Notiz konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [districtId, user, currentTenant]);

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
    refetch: fetchNotes,
  };
}
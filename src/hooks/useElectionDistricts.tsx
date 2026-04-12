import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useTenant } from "./useTenant";
import { useToast } from "@/components/ui/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import { hasOwnProperty, isRecord } from "@/utils/typeSafety";
import {
  type ElectionDistrictFeature,
  type GeoContactInfo,
  type GeoPoint,
  normalizeContactInfo,
  normalizeGeoJsonGeometry,
  normalizeGeoPoint,
  normalizeStringArray,
} from "./geoContracts";

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
  legislature_period?: string;
}

export interface ElectionDistrict {
  id: string;
  district_number: number;
  district_name: string;
  region: string;
  boundaries?: ElectionDistrictFeature["geometry"] | null;
  center_coordinates?: GeoPoint | null;
  population?: number | null;
  area_km2?: number | null;
  contact_info?: GeoContactInfo | null;
  website_url?: string | null;
  district_type?: string | null;
  major_cities?: string[] | null;
  rural_percentage?: number | null;
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
  content?: string | null;
  priority: string;
  category: string | null;
  due_date?: string | null;
  is_completed: boolean;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useElectionDistricts() {
  const { user } = useAuth();
  const { toast } = useToast();

  const normalizeRepresentative = (value: unknown): ElectionRepresentative | null => {
    if (!isRecord(value)) {
      return null;
    }

    const { id, name, party, mandate_type, order_index } = value;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof party !== "string" ||
      (mandate_type !== "direct" && mandate_type !== "list") ||
      typeof order_index !== "number"
    ) {
      return null;
    }

    return {
      id,
      name,
      party,
      mandate_type,
      order_index,
      email: typeof value.email === "string" ? value.email : undefined,
      phone: typeof value.phone === "string" ? value.phone : undefined,
      office_address: typeof value.office_address === "string" ? value.office_address : undefined,
      bio: typeof value.bio === "string" ? value.bio : undefined,
      legislature_period: typeof value.legislature_period === "string" ? value.legislature_period : undefined,
    };
  };

  const normalizeDistrict = (value: unknown): ElectionDistrict | null => {
    if (!isRecord(value)) {
      return null;
    }

    const { id, district_number, district_name, region, created_at, updated_at } = value;
    if (
      typeof id !== "string" ||
      typeof district_number !== "number" ||
      typeof district_name !== "string" ||
      typeof region !== "string" ||
      typeof created_at !== "string" ||
      typeof updated_at !== "string"
    ) {
      return null;
    }

    const representatives = Array.isArray(value.representatives)
      ? value.representatives
          .map((entry) => normalizeRepresentative(entry))
          .filter((entry): entry is ElectionRepresentative => entry !== null)
          .sort((a, b) => {
            if (a.mandate_type === "direct" && b.mandate_type !== "direct") return -1;
            if (a.mandate_type !== "direct" && b.mandate_type === "direct") return 1;
            return a.order_index - b.order_index;
          })
      : [];

    return {
      id,
      district_number,
      district_name,
      region,
      boundaries: normalizeGeoJsonGeometry(value.boundaries),
      center_coordinates: normalizeGeoPoint(value.center_coordinates),
      population: typeof value.population === "number" ? value.population : null,
      area_km2: typeof value.area_km2 === "number" ? value.area_km2 : null,
      contact_info: normalizeContactInfo(value.contact_info),
      website_url: typeof value.website_url === "string" ? value.website_url : null,
      district_type: typeof value.district_type === "string" ? value.district_type : null,
      major_cities: hasOwnProperty(value, "major_cities") ? normalizeStringArray(value.major_cities) : null,
      rural_percentage: typeof value.rural_percentage === "number" ? value.rural_percentage : null,
      representatives,
      created_at,
      updated_at,
    };
  };

  const fetchDistricts = async (): Promise<ElectionDistrict[]> => {
    const { data, error } = await supabase
      .from("election_districts")
      .select(`
        *,
        representatives:election_representatives(
          id, name, party, mandate_type, order_index, email, phone, office_address, bio, legislature_period
        )
      `)
      .order("district_number");

    if (error) throw error;

    return (data ?? [])
      .map((district) => normalizeDistrict(district as unknown))
      .filter((district): district is ElectionDistrict => district !== null);
  };

  const {
    data: districts = [],
    isLoading,
    refetch,
    error: districtsError,
  } = useQuery({
    queryKey: ["election-districts", user?.id],
    queryFn: fetchDistricts,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (districtsError) {
      debugConsole.error("Error fetching election districts:", districtsError);
      toast({
        title: "Fehler beim Laden der Wahlkreise",
        description: "Die Wahlkreisdaten konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  }, [districtsError, toast]);

  return {
    districts,
    loading: isLoading,
    refetch,
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
      debugConsole.error("Error fetching district notes:", error);
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
        .insert([{
          ...noteData,
          user_id: user.id,
          tenant_id: currentTenant.id,
        }])
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
      debugConsole.error("Error creating note:", error);
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
      debugConsole.error("Error updating note:", error);
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
      debugConsole.error("Error deleting note:", error);
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

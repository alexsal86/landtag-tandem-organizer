import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PressReleaseStatusBadge, PressReleaseStatus } from "./PressReleaseStatusBadge";
import { Plus, Search, FileText, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface PressRelease {
  id: string;
  title: string;
  status: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  excerpt?: string | null;
  ghost_post_url?: string | null;
}

interface PressReleasesListProps {
  onCreateNew: () => void;
  onSelect: (id: string) => void;
}

export function PressReleasesList({ onCreateNew, onSelect }: PressReleasesListProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [pressReleases, setPressReleases] = useState<PressRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && currentTenant) {
      fetchPressReleases();
    }
  }, [user, currentTenant]);

  const fetchPressReleases = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('press_releases')
        .select('id, title, status, created_at, created_by, updated_at, excerpt, ghost_post_url')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPressReleases(data || []);

      // Load profiles for creators
      const userIds = [...new Set((data || []).map(pr => pr.created_by))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        
        const profileMap: Record<string, string> = {};
        (profileData || []).forEach(p => {
          profileMap[p.user_id] = p.display_name || 'Unbekannt';
        });
        setProfiles(profileMap);
      }
    } catch (error: any) {
      toast({
        title: "Fehler beim Laden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPressReleases = pressReleases.filter(pr => {
    const matchesSearch = pr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pr.excerpt || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pr.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 min-w-[200px] flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pressemitteilungen durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="draft">Entwurf</SelectItem>
              <SelectItem value="pending_approval">Zur Freigabe</SelectItem>
              <SelectItem value="revision_requested">Überarbeitung</SelectItem>
              <SelectItem value="approved">Freigegeben</SelectItem>
              <SelectItem value="published">Veröffentlicht</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Neue Pressemitteilung
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Wird geladen...</p>
        </div>
      ) : filteredPressReleases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || filterStatus !== 'all' 
                ? 'Keine Ergebnisse gefunden' 
                : 'Noch keine Pressemitteilungen'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterStatus !== 'all'
                ? 'Versuchen Sie andere Filter oder Suchbegriffe.'
                : 'Erstellen Sie Ihre erste Pressemitteilung.'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <Button onClick={onCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Erste Pressemitteilung erstellen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPressReleases.map((pr) => (
            <Card 
              key={pr.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelect(pr.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PressReleaseStatusBadge status={pr.status} />
                      <h3 className="font-semibold truncate">{pr.title}</h3>
                    </div>
                    {pr.excerpt && (
                      <p className="text-sm text-muted-foreground truncate mb-2">{pr.excerpt}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {profiles[pr.created_by] || 'Unbekannt'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(pr.created_at), "dd.MM.yyyy", { locale: de })}
                      </span>
                      {pr.ghost_post_url && (
                        <a 
                          href={pr.ghost_post_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Auf Webseite ansehen →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

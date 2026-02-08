import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PressReleaseStatusBadge } from "./PressReleaseStatusBadge";
import { Plus, Search, FileText, Calendar, User, Settings, Globe, Mail } from "lucide-react";
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
  published_at?: string | null;
  published_by?: string | null;
  email_sent_at?: string | null;
  email_sent_by?: string | null;
}

interface PressReleasesListProps {
  onCreateNew: () => void;
  onSelect: (id: string) => void;
}

export function PressReleasesList({ onCreateNew, onSelect }: PressReleasesListProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [pressReleases, setPressReleases] = useState<PressRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultTags, setDefaultTags] = useState("");
  const [emailTemplateSubject, setEmailTemplateSubject] = useState("");
  const [emailTemplateBody, setEmailTemplateBody] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (user && currentTenant) {
      fetchPressReleases();
      loadSettings();
    }
  }, [user, currentTenant]);

  const loadSettings = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id', currentTenant.id)
      .in('setting_key', ['press_default_tags', 'press_email_template_subject', 'press_email_template_body']);
    (data || []).forEach(s => {
      if (s.setting_key === 'press_default_tags') setDefaultTags(s.setting_value || '');
      if (s.setting_key === 'press_email_template_subject') setEmailTemplateSubject(s.setting_value || '');
      if (s.setting_key === 'press_email_template_body') setEmailTemplateBody(s.setting_value || '');
    });
  };

  const saveSettings = async () => {
    if (!currentTenant) return;
    setSavingSettings(true);
    try {
      const settings = [
        { key: 'press_default_tags', value: defaultTags.trim() },
        { key: 'press_email_template_subject', value: emailTemplateSubject.trim() },
        { key: 'press_email_template_body', value: emailTemplateBody.trim() },
      ];

      for (const { key, value } of settings) {
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('tenant_id', currentTenant.id)
          .eq('setting_key', key)
          .maybeSingle();

        if (existing) {
          await supabase.from('app_settings').update({ setting_value: value }).eq('id', existing.id);
        } else {
          await supabase.from('app_settings').insert({ tenant_id: currentTenant.id, setting_key: key, setting_value: value });
        }
      }

      toast({ title: "Einstellungen gespeichert" });
      setSettingsOpen(false);
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchPressReleases = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('press_releases')
        .select('id, title, status, created_at, created_by, updated_at, excerpt, ghost_post_url, published_at, published_by, email_sent_at, email_sent_by')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPressReleases(data || []);

      // Load profiles for creators, publishers, and email senders
      const userIds = [...new Set([
        ...(data || []).map(pr => pr.created_by),
        ...(data || []).map(pr => pr.published_by).filter(Boolean),
        ...(data || []).map(pr => pr.email_sent_by).filter(Boolean),
      ] as string[])];
      
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
        <div className="flex items-center gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Presse-Einstellungen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Standard-Tags für neue Pressemitteilungen</Label>
                  <Input
                    value={defaultTags}
                    onChange={(e) => setDefaultTags(e.target.value)}
                    placeholder="Pressemitteilung, Politik, ..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Kommagetrennte Tags, die jeder neuen Pressemitteilung automatisch zugewiesen werden.
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="font-semibold">E-Mail-Template für Pressemitteilungen</Label>
                  <p className="text-xs text-muted-foreground">
                    Variablen: {"{{titel}}"}, {"{{excerpt}}"}, {"{{link}}"}, {"{{datum}}"}
                  </p>
                  <div className="space-y-2">
                    <Label>Betreff</Label>
                    <Input
                      value={emailTemplateSubject}
                      onChange={(e) => setEmailTemplateSubject(e.target.value)}
                      placeholder="Pressemitteilung: {{titel}}"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nachrichtentext</Label>
                    <textarea
                      className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={emailTemplateBody}
                      onChange={(e) => setEmailTemplateBody(e.target.value)}
                      placeholder={"Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere aktuelle Pressemitteilung:\n\n{{titel}}\n\n{{excerpt}}\n\nDen vollständigen Beitrag finden Sie unter:\n{{link}}"}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSettingsOpen(false)}>Abbrechen</Button>
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? "Speichern..." : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Neue Pressemitteilung
          </Button>
        </div>
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
                      {pr.status === 'published' && pr.published_at && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Globe className="h-3 w-3" />
                          Veröffentlicht am {format(new Date(pr.published_at), "dd.MM.yyyy", { locale: de })}
                          {pr.published_by && profiles[pr.published_by] && (
                            <> von {profiles[pr.published_by]}</>
                          )}
                        </span>
                      )}
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
                      {pr.email_sent_at && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Mail className="h-3 w-3" />
                          E-Mail versandt am {format(new Date(pr.email_sent_at), "dd.MM.yyyy", { locale: de })}
                          {pr.email_sent_by && profiles[pr.email_sent_by] && (
                            <> von {profiles[pr.email_sent_by]}</>
                          )}
                        </span>
                      )}
                      {pr.status === 'published' && pr.ghost_post_url && !pr.email_sent_at && (
                        <button
                          className="flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/documents?tab=emails&action=compose-press&pressReleaseId=${pr.id}`);
                          }}
                        >
                          <Mail className="h-3 w-3" />
                          Per E-Mail versenden
                        </button>
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

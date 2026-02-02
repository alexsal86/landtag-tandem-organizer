import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, MapPin, Users, Search, Trash2, FileText, LayoutGrid, List, Globe, Lock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MeetingProtocolView } from "./MeetingProtocolView";

interface ArchivedMeeting {
  id: string;
  title: string;
  description?: string;
  meeting_date: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  is_public?: boolean;
}

interface MeetingArchiveViewProps {
  onBack: () => void;
}

export function MeetingArchiveView({ onBack }: MeetingArchiveViewProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [archivedMeetings, setArchivedMeetings] = useState<ArchivedMeeting[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    if (user) {
      loadArchivedMeetings();
    }
  }, [user, currentTenant?.id]);

  const loadArchivedMeetings = async () => {
    try {
      setLoading(true);
      
      // 1. Load meetings where user is the creator
      const { data: ownMeetings, error: ownError } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'archived')
        .order('meeting_date', { ascending: false });

      if (ownError) throw ownError;
      
      // 2. Load meetings where user is a participant
      const { data: participantMeetings, error: participantError } = await supabase
        .from('meeting_participants')
        .select('meeting_id, meetings(*)')
        .eq('user_id', user?.id);

      if (participantError) {
        console.error('Error loading participant meetings:', participantError);
      }
      
      const participantArchivedMeetings = (participantMeetings || [])
        .filter(p => p.meetings && p.meetings.status === 'archived')
        .map(p => p.meetings);
      
      // 3. Load public archived meetings from the same tenant (excluding already loaded)
      const existingMeetingIds = new Set([
        ...(ownMeetings || []).map(m => m.id),
        ...participantArchivedMeetings.map(m => m?.id).filter(Boolean)
      ]);
      
      let publicMeetings: any[] = [];
      if (currentTenant?.id) {
        const { data: publicData, error: publicError } = await supabase
          .from('meetings')
          .select('*')
          .eq('status', 'archived')
          .eq('is_public', true)
          .eq('tenant_id', currentTenant.id);
        
        if (publicError) {
          console.error('Error loading public meetings:', publicError);
        } else {
          publicMeetings = (publicData || []).filter(m => !existingMeetingIds.has(m.id));
        }
      }
      
      // Combine and deduplicate
      const allMeetingsMap = new Map();
      [...(ownMeetings || []), ...participantArchivedMeetings, ...publicMeetings]
        .filter(Boolean)
        .forEach(m => allMeetingsMap.set(m.id, m));
      
      const allMeetings = Array.from(allMeetingsMap.values())
        .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
      
      setArchivedMeetings(allMeetings);
    } catch (error) {
      console.error('Error loading archived meetings:', error);
      toast({
        title: "Fehler",
        description: "Archivierte Besprechungen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const canManageMeeting = (meeting: ArchivedMeeting) => {
    return meeting.user_id === user?.id;
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      // Delete agenda items first
      await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete the meeting
      await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      // Reload the list
      await loadArchivedMeetings();
      
      toast({
        title: "Besprechung gelöscht",
        description: "Die archivierte Besprechung wurde erfolgreich gelöscht."
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast({
        title: "Fehler",
        description: "Die Besprechung konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  };

  const restoreMeeting = async (meeting: ArchivedMeeting) => {
    try {
      await supabase
        .from('meetings')
        .update({ status: 'planned' })
        .eq('id', meeting.id);

      await loadArchivedMeetings();
      
      toast({
        title: "Besprechung wiederhergestellt",
        description: "Die Besprechung wurde aus dem Archiv wiederhergestellt."
      });
    } catch (error) {
      console.error('Error restoring meeting:', error);
      toast({
        title: "Fehler",
        description: "Die Besprechung konnte nicht wiederhergestellt werden.",
        variant: "destructive"
      });
    }
  };

  const filteredMeetings = archivedMeetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    meeting.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    meeting.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (meeting: ArchivedMeeting) => {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="secondary">Archiviert</Badge>
        {meeting.is_public ? (
          <Badge variant="outline" className="text-xs">
            <Globe className="h-3 w-3 mr-1" />
            Öffentlich
          </Badge>
        ) : null}
      </div>
    );
  };

  // Show protocol view if a meeting is selected
  if (selectedMeetingId) {
    return (
      <MeetingProtocolView 
        meetingId={selectedMeetingId} 
        onBack={() => setSelectedMeetingId(null)} 
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade archivierte Besprechungen...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Besprechungsarchiv</h1>
            <p className="text-muted-foreground">
              {archivedMeetings.length} archivierte {archivedMeetings.length === 1 ? 'Besprechung' : 'Besprechungen'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Besprechungen durchsuchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Archive List */}
      {filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'Keine Ergebnisse gefunden' : 'Keine archivierten Besprechungen'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? 'Versuchen Sie andere Suchbegriffe.' 
                  : 'Beendete Besprechungen erscheinen hier im Archiv.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="border rounded-lg divide-y bg-card">
          {filteredMeetings.map((meeting) => (
            <div 
              key={meeting.id} 
              className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
              onClick={() => setSelectedMeetingId(meeting.id)}
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{meeting.title}</span>
                    {meeting.is_public && (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {!canManageMeeting(meeting) && (
                      <Badge variant="outline" className="text-xs">Nur Ansicht</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
                    </span>
                    {meeting.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {meeting.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMeetingId(meeting.id);
                  }}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                {canManageMeeting(meeting) && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreMeeting(meeting);
                      }}
                    >
                      Wiederherstellen
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Besprechung löschen</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sind Sie sicher, dass Sie "{meeting.title}" endgültig löschen möchten? 
                            Diese Aktion kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteMeeting(meeting.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting) => (
            <Card 
              key={meeting.id} 
              className="hover:shadow-elegant transition-shadow cursor-pointer"
              onClick={() => setSelectedMeetingId(meeting.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      {meeting.is_public && (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {meeting.description}
                    </CardDescription>
                  </div>
                  {getStatusBadge(meeting)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
                </div>
                {meeting.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {meeting.location}
                  </div>
                )}
                
                {!canManageMeeting(meeting) && (
                  <Badge variant="outline" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Nur Ansicht
                  </Badge>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMeetingId(meeting.id);
                    }}
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Protokoll
                  </Button>
                  {canManageMeeting(meeting) && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreMeeting(meeting);
                        }}
                        className="flex-1"
                      >
                        Wiederherstellen
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Besprechung löschen</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sind Sie sicher, dass Sie "{meeting.title}" endgültig löschen möchten? 
                              Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteMeeting(meeting.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

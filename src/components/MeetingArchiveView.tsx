import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, MapPin, Users, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ArchivedMeeting {
  id: string;
  title: string;
  description?: string;
  meeting_date: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MeetingArchiveViewProps {
  onBack: () => void;
}

export function MeetingArchiveView({ onBack }: MeetingArchiveViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [archivedMeetings, setArchivedMeetings] = useState<ArchivedMeeting[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadArchivedMeetings();
    }
  }, [user]);

  const loadArchivedMeetings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'archived')
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setArchivedMeetings(data || []);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'archived':
        return <Badge variant="secondary">Archiviert</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade archivierte Besprechungen...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting) => (
            <Card key={meeting.id} className="hover:shadow-elegant transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{meeting.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {meeting.description}
                    </CardDescription>
                  </div>
                  {getStatusBadge(meeting.status)}
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
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => restoreMeeting(meeting)}
                    className="flex-1"
                  >
                    Wiederherstellen
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
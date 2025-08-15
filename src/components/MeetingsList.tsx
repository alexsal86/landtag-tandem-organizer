import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Clock, Users, CheckCircle, Circle, Edit, Trash } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Meeting } from "@/types/meeting";
import { MeetingForm } from "@/components/MeetingForm";

interface MeetingsListProps {
  meetings: Meeting[];
  onCreateMeeting: (meeting: Meeting) => Promise<Meeting | null>;
  onUpdateMeeting: (meeting: Meeting) => Promise<void>;
  onDeleteMeeting: (meetingId: string) => Promise<void>;
  onSelectMeeting: (meeting: Meeting) => void;
  onStartMeeting: (meeting: Meeting) => void;
  selectedMeeting: Meeting | null;
  activeMeeting: Meeting | null;
  meetingTemplates: any[];
}

export function MeetingsList({
  meetings,
  onCreateMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  onSelectMeeting,
  onStartMeeting,
  selectedMeeting,
  activeMeeting,
  meetingTemplates
}: MeetingsListProps) {
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateMeeting = async (meeting: Meeting) => {
    const result = await onCreateMeeting(meeting);
    if (result) {
      setIsNewMeetingOpen(false);
      onSelectMeeting(result);
    }
  };

  const handleUpdateMeeting = async (meeting: Meeting) => {
    await onUpdateMeeting(meeting);
    setEditingMeeting(null);
  };

  const upcomingMeetings = meetings.filter(m => {
    const meetingDate = new Date(m.meeting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return meetingDate >= today && m.status !== 'completed';
  });

  const pastMeetings = meetings.filter(m => {
    const meetingDate = new Date(m.meeting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return meetingDate < today || m.status === 'completed';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meetings</h2>
          <p className="text-muted-foreground">Verwalten Sie Ihre Meetings und Agenden</p>
        </div>
        <Dialog open={isNewMeetingOpen} onOpenChange={setIsNewMeetingOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neues Meeting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Meeting erstellen</DialogTitle>
              <DialogDescription>
                Erstellen Sie ein neues Meeting mit vordefinierter Agenda.
              </DialogDescription>
            </DialogHeader>
            <MeetingForm
              onSubmit={handleCreateMeeting}
              onCancel={() => setIsNewMeetingOpen(false)}
              meetingTemplates={meetingTemplates}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Meeting Banner */}
      {activeMeeting && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <CardTitle className="text-lg text-green-800">
                Aktives Meeting: {activeMeeting.title}
              </CardTitle>
            </div>
            <CardDescription className="text-green-700">
              {format(new Date(activeMeeting.meeting_date), 'dd. MMMM yyyy', { locale: de })}
              {activeMeeting.location && ` • ${activeMeeting.location}`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Upcoming Meetings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Anstehende Meetings ({upcomingMeetings.length})
        </h3>
        
        {upcomingMeetings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Keine anstehenden Meetings vorhanden.
              </p>
              <Button 
                onClick={() => setIsNewMeetingOpen(true)}
                className="mt-4"
                variant="outline"
              >
                Erstes Meeting erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {upcomingMeetings.map((meeting) => (
              <Card 
                key={meeting.id} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedMeeting?.id === meeting.id ? 'ring-2 ring-primary' : ''
                } ${
                  activeMeeting?.id === meeting.id ? 'border-green-200 bg-green-50' : ''
                }`}
                onClick={() => onSelectMeeting(meeting)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(meeting.status)}
                        {meeting.title}
                        {activeMeeting?.id === meeting.id && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Aktiv
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(meeting.meeting_date), 'dd. MMMM yyyy', { locale: de })}
                        {meeting.location && ` • ${meeting.location}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeMeeting?.id !== meeting.id && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartMeeting(meeting);
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Starten
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMeeting(meeting);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Meeting löschen</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sind Sie sicher, dass Sie das Meeting "{meeting.title}" löschen möchten? 
                              Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => meeting.id && onDeleteMeeting(meeting.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                {meeting.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{meeting.description}</p>
                  </CardContent>
                )}
                <CardContent className="pt-0">
                  <Badge className={getStatusColor(meeting.status)}>
                    {meeting.status === 'planned' ? 'Geplant' : 
                     meeting.status === 'in-progress' ? 'In Bearbeitung' :
                     meeting.status === 'completed' ? 'Abgeschlossen' : 
                     meeting.status === 'cancelled' ? 'Abgesagt' : meeting.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Vergangene Meetings ({pastMeetings.length})
          </h3>
          <div className="grid gap-3">
            {pastMeetings.slice(0, 5).map((meeting) => (
              <Card 
                key={meeting.id} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 opacity-75 ${
                  selectedMeeting?.id === meeting.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onSelectMeeting(meeting)}
              >
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {getStatusIcon(meeting.status)}
                        {meeting.title}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {format(new Date(meeting.meeting_date), 'dd. MMMM yyyy', { locale: de })}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(meeting.status)}>
                      {meeting.status === 'completed' ? 'Abgeschlossen' : 'Vergangen'}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit Meeting Dialog */}
      <Dialog open={!!editingMeeting} onOpenChange={() => setEditingMeeting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meeting bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Meeting-Details.
            </DialogDescription>
          </DialogHeader>
          {editingMeeting && (
            <MeetingForm
              meeting={editingMeeting}
              onSubmit={handleUpdateMeeting}
              onCancel={() => setEditingMeeting(null)}
              meetingTemplates={meetingTemplates}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
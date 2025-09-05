import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Calendar, MapPin, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppointmentData {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
}

interface GuestData {
  id: string;
  name: string;
  email: string;
  status: string;
  responded_at?: string;
  response_note?: string;
}

export default function GuestResponse() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [guest, setGuest] = useState<GuestData | null>(null);
  const [response, setResponse] = useState<'confirmed' | 'declined' | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchGuestData();
    }
  }, [token]);

  const fetchGuestData = async () => {
    if (!token) return;

    try {
      // Get guest data by token
      const { data: guestData, error: guestError } = await supabase
        .from('appointment_guests')
        .select(`
          *,
          appointments (
            id,
            title,
            description,
            start_time,
            end_time,
            location
          )
        `)
        .eq('invitation_token', token)
        .single();

      if (guestError || !guestData) {
        setError('Einladung nicht gefunden oder ungültig');
        return;
      }

      setGuest(guestData);
      
      // Get appointment separately since the relation might not work
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('id, title, description, start_time, end_time, location')
        .eq('id', guestData.appointment_id)
        .single();
        
      if (appointmentError || !appointmentData) {
        setError('Termin nicht gefunden');
        return;
      }
      
      setAppointment(appointmentData);

      // If already responded, show current response
      if (guestData.status !== 'invited') {
        setResponse(guestData.status === 'confirmed' ? 'confirmed' : 'declined');
        setNote(guestData.response_note || '');
      }

    } catch (error: any) {
      console.error('Error fetching guest data:', error);
      setError('Fehler beim Laden der Einladung');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!guest || !response) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('appointment_guests')
        .update({
          status: response,
          responded_at: new Date().toISOString(),
          response_note: note.trim() || null
        })
        .eq('id', guest.id);

      if (error) throw error;

      toast.success(
        response === 'confirmed' 
          ? 'Teilnahme bestätigt! Vielen Dank.' 
          : 'Absage registriert. Vielen Dank für Ihre Rückmeldung.'
      );

      // Refresh data to show updated status
      fetchGuestData();

    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast.error('Fehler beim Übermitteln der Antwort');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-pulse">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-blue-500" />
          </div>
          <p className="text-muted-foreground">Lade Einladung...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment || !guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2">Einladung nicht gefunden</h2>
            <p className="text-muted-foreground">
              {error || 'Die Einladung ist möglicherweise abgelaufen oder ungültig.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasResponded = guest.status !== 'invited';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Termineinladung</h1>
          <p className="text-muted-foreground">
            Sie wurden zu folgendem Termin eingeladen
          </p>
        </div>

        {/* Appointment Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-center">{appointment.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">Datum</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(appointment.start_time)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Zeit</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                  </p>
                </div>
              </div>
            </div>

            {appointment.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium">Ort</p>
                  <p className="text-sm text-muted-foreground">{appointment.location}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Eingeladen als</p>
                <p className="text-sm text-muted-foreground">{guest.name}</p>
              </div>
            </div>

            {appointment.description && (
              <>
                <Separator />
                <div>
                  <p className="font-medium mb-2">Beschreibung</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {appointment.description}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Response Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {hasResponded ? (
                guest.status === 'confirmed' ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )
              ) : null}
              {hasResponded ? 'Ihre Antwort' : 'Bitte antworten Sie'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {hasResponded && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={guest.status === 'confirmed' ? 'default' : 'destructive'}>
                    {guest.status === 'confirmed' ? 'Zugesagt' : 'Abgesagt'}
                  </Badge>
                  {guest.responded_at && (
                    <span className="text-sm text-muted-foreground">
                      am {formatDate(guest.responded_at)} um {formatTime(guest.responded_at)}
                    </span>
                  )}
                </div>
                {guest.response_note && (
                  <p className="text-sm text-muted-foreground mt-2">
                    "{guest.response_note}"
                  </p>
                )}
              </div>
            )}

            {/* Response Buttons */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={response === 'confirmed' ? 'default' : 'outline'}
                  onClick={() => setResponse('confirmed')}
                  className="h-12"
                  disabled={hasResponded}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Zusagen
                </Button>
                <Button
                  variant={response === 'declined' ? 'destructive' : 'outline'}
                  onClick={() => setResponse('declined')}
                  className="h-12"
                  disabled={hasResponded}
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Absagen
                </Button>
              </div>

              {response && !hasResponded && (
                <div className="space-y-2">
                  <Label htmlFor="response-note">
                    Nachricht (optional)
                  </Label>
                  <Textarea
                    id="response-note"
                    placeholder={
                      response === 'confirmed' 
                        ? "Freue mich auf den Termin!" 
                        : "Leider kann ich nicht teilnehmen, weil..."
                    }
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {response && !hasResponded && (
                <Button
                  onClick={handleSubmitResponse}
                  disabled={submitting}
                  className="w-full h-12"
                  size="lg"
                >
                  {submitting ? 'Wird gesendet...' : 'Antwort senden'}
                </Button>
              )}
            </div>

            {hasResponded && (
              <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                <p>
                  Sie haben bereits auf diese Einladung geantwortet.
                  <br />
                  Bei Fragen wenden Sie sich bitte direkt an den Organisator.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Diese Einladung wurde automatisch generiert.</p>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Check, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function EventRSVP() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rsvp, setRsvp] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!eventId || !token) {
        setLoading(false);
        return;
      }
      try {
        // Load RSVP by token
        const { data: rsvpData, error: rsvpError } = await supabase
          .from('event_rsvps')
          .select('*')
          .eq('event_planning_id', eventId)
          .eq('token', token)
          .maybeSingle();

        if (rsvpError) throw rsvpError;
        if (!rsvpData) {
          setLoading(false);
          return;
        }
        setRsvp(rsvpData);
        setComment(rsvpData.comment || '');

        // Load event
        const { data: eventData, error: eventError } = await supabase
          .from('event_plannings')
          .select('title, description, confirmed_date, location')
          .eq('id', eventId)
          .maybeSingle();

        if (eventError) throw eventError;
        setEvent(eventData);

        if (rsvpData.status !== 'invited') {
          setSubmitted(true);
        }
      } catch (error) {
        console.error('Error loading RSVP data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [eventId, token]);

  const respond = async (status: 'accepted' | 'declined' | 'tentative') => {
    if (!rsvp) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .update({
          status,
          comment: comment || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', rsvp.id);

      if (error) throw error;

      setRsvp({ ...rsvp, status });
      setSubmitted(true);
      toast({
        title: "Antwort gespeichert",
        description: status === 'accepted' ? 'Sie haben zugesagt.' : status === 'declined' ? 'Sie haben abgesagt.' : 'Sie haben unter Vorbehalt zugesagt.',
      });
    } catch (error) {
      console.error('Error saving response:', error);
      toast({ title: "Fehler", description: "Antwort konnte nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!eventId || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-destructive">Ungültiger Einladungslink.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Lädt...</div>
      </div>
    );
  }

  if (!rsvp || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-destructive">Einladung nicht gefunden oder ungültiger Link.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="bg-green-500 text-white">Zugesagt</Badge>;
      case 'declined': return <Badge variant="destructive">Abgesagt</Badge>;
      case 'tentative': return <Badge className="bg-yellow-500 text-white">Unter Vorbehalt</Badge>;
      default: return <Badge variant="outline">Eingeladen</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto py-8 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {event.title}
            </CardTitle>
            <CardDescription>
              {event.description && <div className="mb-2">{event.description}</div>}
              {event.confirmed_date && (
                <div className="text-sm">
                  Datum: {format(new Date(event.confirmed_date), 'dd. MMMM yyyy', { locale: de })}
                </div>
              )}
              {event.location && (
                <div className="text-sm">Ort: {event.location}</div>
              )}
              <div className="mt-2">
                Eingeladen: <strong>{rsvp.name}</strong> ({rsvp.email})
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">{getStatusBadge(rsvp.status)}</div>
                <p className="text-muted-foreground">
                  Ihre Antwort wurde gespeichert. Sie können sie jederzeit ändern.
                </p>
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Antwort ändern
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="comment">Kommentar (optional)</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Anmerkungen..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => respond('accepted')}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4 mr-1" /> Zusagen
                  </Button>
                  <Button
                    onClick={() => respond('tentative')}
                    disabled={saving}
                    variant="outline"
                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" /> Vorbehalt
                  </Button>
                  <Button
                    onClick={() => respond('declined')}
                    disabled={saving}
                    variant="destructive"
                  >
                    <X className="h-4 w-4 mr-1" /> Absagen
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

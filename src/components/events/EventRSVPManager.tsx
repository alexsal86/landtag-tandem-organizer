import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Mail, Send, Check, X, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { ContactSelector } from '@/components/ContactSelector';

interface EventRSVP {
  id: string;
  email: string;
  name: string;
  status: string;
  comment?: string;
  responded_at?: string;
  invited_at?: string;
  token: string;
}

interface EventRSVPManagerProps {
  eventPlanningId: string;
  eventTitle: string;
}

export const EventRSVPManager = ({ eventPlanningId, eventTitle }: EventRSVPManagerProps) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [pendingInvites, setPendingInvites] = useState<{ name: string; email: string }[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadRSVPs();
  }, [eventPlanningId]);

  const loadRSVPs = async () => {
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_planning_id', eventPlanningId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRsvps(data || []);
    } catch (error) {
      console.error('Error loading RSVPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFromContact = (contact: any) => {
    if (!contact.email) {
      toast({ title: "Keine E-Mail", description: "Kontakt hat keine E-Mail-Adresse.", variant: "destructive" });
      return;
    }
    if (pendingInvites.find(p => p.email === contact.email) || rsvps.find(r => r.email === contact.email)) {
      toast({ title: "Bereits vorhanden", variant: "destructive" });
      return;
    }
    setPendingInvites(prev => [...prev, { name: contact.name, email: contact.email }]);
  };

  const addExternalEmail = () => {
    if (!newEmail) return;
    if (pendingInvites.find(p => p.email === newEmail) || rsvps.find(r => r.email === newEmail)) {
      toast({ title: "Bereits vorhanden", variant: "destructive" });
      return;
    }
    setPendingInvites(prev => [...prev, { name: newEmail.split('@')[0], email: newEmail }]);
    setNewEmail('');
  };

  const removePending = (email: string) => {
    setPendingInvites(prev => prev.filter(p => p.email !== email));
  };

  const sendInvitations = async () => {
    if (pendingInvites.length === 0) return;
    setSending(true);

    try {
      // Insert RSVPs
      const rsvpData = pendingInvites.map(p => ({
        event_planning_id: eventPlanningId,
        email: p.email,
        name: p.name,
        tenant_id: currentTenant?.id
      }));

      const { data: insertedRsvps, error: insertError } = await supabase
        .from('event_rsvps')
        .insert(rsvpData)
        .select();

      if (insertError) throw insertError;

      // Send invitation emails via edge function
      if (insertedRsvps && insertedRsvps.length > 0) {
        try {
          await supabase.functions.invoke('send-event-invitation', {
            body: {
              eventPlanningId,
              eventTitle,
              rsvpIds: insertedRsvps.map(r => r.id)
            }
          });
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
          // Don't throw - RSVPs are created, just email failed
        }
      }

      toast({
        title: "Einladungen versendet",
        description: `${pendingInvites.length} Einladung(en) wurden erstellt.`,
      });

      setPendingInvites([]);
      setDialogOpen(false);
      loadRSVPs();
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast({ title: "Fehler", description: "Einladungen konnten nicht versendet werden.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const deleteRSVP = async (rsvpId: string) => {
    try {
      const { error } = await supabase
        .from('event_rsvps')
        .delete()
        .eq('id', rsvpId);

      if (error) throw error;
      setRsvps(prev => prev.filter(r => r.id !== rsvpId));
      toast({ title: "Einladung entfernt" });
    } catch (error) {
      console.error('Error deleting RSVP:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted': return <Badge className="bg-green-500 text-white"><Check className="h-3 w-3 mr-1" />Zugesagt</Badge>;
      case 'declined': return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Abgesagt</Badge>;
      case 'tentative': return <Badge className="bg-yellow-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />Vorbehalt</Badge>;
      default: return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Eingeladen</Badge>;
    }
  };

  const accepted = rsvps.filter(r => r.status === 'accepted').length;
  const declined = rsvps.filter(r => r.status === 'declined').length;
  const pending = rsvps.filter(r => r.status === 'invited').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Einladungen & RSVP
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Send className="h-4 w-4 mr-2" />
                Einladungen versenden
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Gäste einladen</DialogTitle>
                <DialogDescription>Wählen Sie Kontakte oder geben Sie E-Mail-Adressen ein.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Aus Kontakten</Label>
                  <ContactSelector
                    onSelect={addFromContact}
                    placeholder="Kontakt auswählen..."
                    clearAfterSelect={true}
                  />
                </div>
                <div>
                  <Label className="text-sm">E-Mail-Adresse</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="gast@email.de"
                      onKeyPress={(e) => e.key === 'Enter' && addExternalEmail()}
                    />
                    <Button onClick={addExternalEmail} size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {pendingInvites.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Ausstehende Einladungen:</Label>
                    <div className="flex flex-wrap gap-2">
                      {pendingInvites.map((p) => (
                        <Badge key={p.email} variant="secondary" className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {p.name}
                          <button onClick={() => removePending(p.email)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={sendInvitations} disabled={sending || pendingInvites.length === 0}>
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? 'Sende...' : `${pendingInvites.length} Einladung(en) senden`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-muted-foreground animate-pulse py-4">Lädt...</div>
        ) : rsvps.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Noch keine Einladungen versendet.
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-4 text-sm">
              <span className="text-green-600 font-medium">{accepted} zugesagt</span>
              <span className="text-destructive font-medium">{declined} abgesagt</span>
              <span className="text-muted-foreground">{pending} ausstehend</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Antwort am</TableHead>
                  <TableHead className="text-center">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rsvps.map((rsvp) => (
                  <TableRow key={rsvp.id}>
                    <TableCell className="font-medium">{rsvp.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rsvp.email}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(rsvp.status)}</TableCell>
                    <TableCell className="text-center text-sm">
                      {rsvp.responded_at
                        ? format(new Date(rsvp.responded_at), 'dd.MM.yyyy HH:mm', { locale: de })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRSVP(rsvp.id)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
};

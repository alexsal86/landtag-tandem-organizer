import React, { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Edit3, FileText, RotateCcw, Send, Activity, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { STATUS_LABELS, SENT_METHOD_LABELS, getNextStatus } from './types';
import type { Letter } from './types';

const STATUS_ICONS: Record<string, any> = {
  draft: Edit3,
  review: Users,
  pending_approval: Clock,
  approved: CheckCircle,
  revision_requested: RotateCcw,
  sent: Send,
};

interface LetterBriefDetailsProps {
  editedLetter: Partial<Letter>;
  setEditedLetter: React.Dispatch<React.SetStateAction<Partial<Letter>>>;
  canEdit: boolean;
  isReviewer: boolean;
  userProfiles: Record<string, { display_name: string; avatar_url?: string }>;
  onStatusTransition: (newStatus: string) => void;
  /** Muss true liefern, wenn die Rueckgabe gespeichert wurde. */
  onReturnLetter: (reason: string) => boolean | Promise<boolean>;
  broadcastContentChange: (field: string, value: string) => void;
}

const LetterBriefDetails: React.FC<LetterBriefDetailsProps> = ({
  editedLetter,
  setEditedLetter,
  canEdit,
  isReviewer,
  userProfiles,
  onStatusTransition,
  onReturnLetter,
  broadcastContentChange,
}) => {
  const status = editedLetter.status || 'draft';
  // Die Begründung hängt am Brief selbst (letters.revision_comment), nicht an
  // einer per Titel gesuchten Aufgabe.
  const revisionComment = editedLetter.revision_comment?.trim() || null;
  const revisionReviewer = editedLetter.revision_requested_by ? userProfiles[editedLetter.revision_requested_by] : undefined;
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Der Dialog schliesst nur bei tatsaechlichem Erfolg, damit eine fehlgeschlagene
  // Rueckgabe die geschriebene Begruendung nicht verwirft.
  const submitReturn = async () => {
    if (!returnReason.trim() || isReturning) return;
    setIsReturning(true);
    try {
      const succeeded = await onReturnLetter(returnReason);
      if (succeeded) {
        setIsReturnDialogOpen(false);
        setReturnReason('');
      }
    } catch {
      // Den Fehler meldet der Aufrufer; der Dialog bleibt bewusst offen.
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="border-b bg-card/30 p-4 overflow-y-auto max-h-[45vh]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Briefdetails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Revision Banner */}
          {(status === 'revision_requested' || status === 'draft') && revisionComment && (
            <div className="p-4 border border-palette-orange/30 rounded-lg bg-palette-orange/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-palette-orange mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-palette-orange">
                    {status === 'revision_requested' ? 'Überarbeitung angefordert' : 'Zurückgegeben mit Begründung'}
                  </p>
                  <p className="text-sm text-palette-orange mt-1 whitespace-pre-wrap">{revisionComment}</p>
                  {(revisionReviewer?.display_name || editedLetter.revision_requested_at) && (
                    <p className="text-xs text-palette-orange/80 mt-2">
                      {revisionReviewer?.display_name ? `von ${revisionReviewer.display_name}` : ''}
                      {revisionReviewer?.display_name && editedLetter.revision_requested_at ? ' · ' : ''}
                      {editedLetter.revision_requested_at
                        ? new Date(editedLetter.revision_requested_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="p-4 border rounded-lg bg-card/50">
            <div className="flex items-center gap-2 mb-3">
              {React.createElement(STATUS_ICONS[status] || Edit3, { className: 'h-4 w-4 text-primary' })}
              <Label className="text-base font-medium">Status</Label>
              <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
            </div>

            {canEdit && (
              <div className="flex flex-col gap-2">
                {getNextStatus(status) && (
                  <Button size="sm" variant="outline" onClick={() => onStatusTransition(getNextStatus(status)!)} className="justify-start">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Zu &quot;{STATUS_LABELS[getNextStatus(status)!]}&quot;
                  </Button>
                )}
                {status === 'review' && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Users className="h-3.5 w-3.5" />
                    Brief wird von Kollegen geprüft
                  </div>
                )}
                {status === 'pending_approval' && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    Entscheidung beim Prüfer ausstehend
                  </div>
                )}
                {status === 'approved' && (
                  <Button size="sm" variant="outline" onClick={() => onStatusTransition('pending_approval')} className="justify-start text-muted-foreground">
                    Zurück zur Prüfung
                  </Button>
                )}
              </div>
            )}

            {(status === 'review' || status === 'pending_approval') && isReviewer && (
              <Button size="sm" variant="outline" onClick={() => setIsReturnDialogOpen(true)} className="justify-start text-palette-orange hover:text-palette-orange mt-2">
                <RotateCcw className="h-4 w-4 mr-2" />
                Brief zurückgeben
              </Button>
            )}
          </div>

          {/* Sending Details */}
          {(status === 'approved' || status === 'sent') && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Send className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">Versand</Label>
              </div>
              <div>
                <Label htmlFor="sent-method">Versandart</Label>
                <Select
                  value={editedLetter.sent_method || ''}
                  onValueChange={(value: 'post' | 'email' | 'both') => {
                    setEditedLetter(prev => ({ ...prev, sent_method: value }));
                    broadcastContentChange('sent_method', value);
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Versandart wählen..." />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {Object.entries(SENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {status === 'sent' && (
                <div>
                  <Label htmlFor="sent-date">Versanddatum</Label>
                  <Input
                    id="sent-date"
                    type="date"
                    value={editedLetter.sent_date || ''}
                    onChange={(e) => {
                      setEditedLetter(prev => ({ ...prev, sent_date: e.target.value }));
                      broadcastContentChange('sent_date', e.target.value);
                    }}
                    disabled={!canEdit}
                  />
                </div>
              )}
            </div>
          )}

          {/* Response Tracking */}
          {editedLetter.expected_response_date && status === 'sent' && (() => {
            const expectedDate = new Date(editedLetter.expected_response_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expectedDate.setHours(0, 0, 0, 0);
            const daysUntil = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const isOverdue = daysUntil < 0;
            const isUrgent = daysUntil >= 0 && daysUntil <= 3;

            return (
              <div className={`p-4 border rounded-lg ${
                isOverdue ? 'border-destructive/50 bg-destructive/5' : isUrgent ? 'border-palette-orange/40 bg-palette-orange/10' : 'bg-card/50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <Label className="text-base font-medium">Antwortverfolgung</Label>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Antwort erwartet bis:</span>
                    <span className="font-medium">{new Date(editedLetter.expected_response_date).toLocaleDateString('de-DE')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    {isOverdue ? (
                      <Badge variant="destructive" className="text-xs">
                        {Math.abs(daysUntil)} Tag{Math.abs(daysUntil) !== 1 ? 'e' : ''} überfällig
                      </Badge>
                    ) : isUrgent ? (
                      <Badge className="text-xs bg-palette-orange text-white">
                        Noch {daysUntil} Tag{daysUntil !== 1 ? 'e' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Noch {daysUntil} Tag{daysUntil !== 1 ? 'e' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Workflow History */}
          {(editedLetter.submitted_for_review_at || editedLetter.approved_at || editedLetter.sent_at) && (
            <div className="p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Workflow-Historie</span>
              </div>
              <div className="space-y-1">
                {editedLetter.submitted_for_review_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3 w-3" />
                    <span>Eingereicht: {new Date(editedLetter.submitted_for_review_at).toLocaleDateString('de-DE')}</span>
                    {editedLetter.submitted_for_review_by && userProfiles[editedLetter.submitted_for_review_by] && (
                      <span className="text-muted-foreground">von {userProfiles[editedLetter.submitted_for_review_by].display_name}</span>
                    )}
                  </div>
                )}
                {editedLetter.approved_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3 w-3" />
                    <span>Genehmigt: {new Date(editedLetter.approved_at).toLocaleDateString('de-DE')}</span>
                    {editedLetter.approved_by && userProfiles[editedLetter.approved_by] && (
                      <span className="text-muted-foreground">von {userProfiles[editedLetter.approved_by].display_name}</span>
                    )}
                  </div>
                )}
                {editedLetter.sent_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="h-3 w-3" />
                    <span>Versendet: {new Date(editedLetter.sent_at).toLocaleDateString('de-DE')}</span>
                    {editedLetter.sent_by && userProfiles[editedLetter.sent_by] && (
                      <span className="text-muted-foreground">von {userProfiles[editedLetter.sent_by].display_name}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isReturnDialogOpen}
        onOpenChange={(open) => {
          if (!open && isReturning) return;
          setIsReturnDialogOpen(open);
          if (!open) setReturnReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brief zurückgeben</DialogTitle>
            <DialogDescription>
              Die Begründung wird am Brief gespeichert, dem Ersteller angezeigt und als Benachrichtigung verschickt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-reason">Begründung</Label>
            <Textarea
              id="return-reason"
              value={returnReason}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="Was soll geändert werden?"
              rows={5}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {status === 'pending_approval'
                ? 'Der Brief wechselt in den Status „Überarbeitung“.'
                : 'Der Brief wechselt zurück in den Entwurf.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isReturning} onClick={() => { setIsReturnDialogOpen(false); setReturnReason(''); }}>
              Abbrechen
            </Button>
            <Button disabled={!returnReason.trim() || isReturning} onClick={() => { void submitReturn(); }}>
              <RotateCcw className="h-4 w-4 mr-2" />{isReturning ? 'Wird zurückgegeben…' : 'Zurückgeben'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LetterBriefDetails;

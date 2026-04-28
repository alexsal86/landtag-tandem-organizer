import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Edit3, FileText, RotateCcw, Send, Activity, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_LABELS, SENT_METHOD_LABELS, getNextStatus } from './types';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
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
  onReturnLetter: () => void;
  broadcastContentChange: (field: string, value: string) => void;
}

const useRevisionComment = (letterId?: string, status?: string) => {
  const [revisionComment, setRevisionComment] = useState<string | null>(null);
  useEffect(() => {
    if (status !== 'revision_requested' || !letterId) { setRevisionComment(null); return; }
    const fetchComment = async () => {
      try {
        const { data } = await supabase
          .from('tasks')
          .select('description')
          .ilike('title', `%Brief überarbeiten%`)
          .order('created_at', { ascending: false })
          .limit(5);
        if (data) {
          const match = data.find(t: Record<string, any> => t.description?.includes('Begründung der Zurückweisung'));
          if (match?.description) {
            const parts = match.description.split('Begründung der Zurückweisung:\n\n');
            setRevisionComment(parts[1] || match.description);
            return;
          }
        }
        setRevisionComment(null);
      } catch (e) {
        debugConsole.error('Error fetching revision comment:', e);
        setRevisionComment(null);
      }
    };
    fetchComment();
  }, [letterId, status]);
  return revisionComment;
};

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
  const revisionComment = useRevisionComment((editedLetter as any).id, status);

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
          {status === 'revision_requested' && (
            <div className="p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Überarbeitung angefordert</p>
                  {revisionComment ? (
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1 whitespace-pre-wrap">{revisionComment}</p>
                  ) : (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Keine Begründung angegeben.</p>
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
              <Button size="sm" variant="outline" onClick={onReturnLetter} className="justify-start text-orange-600 hover:text-orange-700 mt-2">
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
                isOverdue ? 'border-destructive/50 bg-destructive/5' : isUrgent ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/20' : 'bg-card/50'
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
                      <Badge className="text-xs bg-orange-500 text-white">
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
    </div>
  );
};

export default LetterBriefDetails;

import React from 'react';
import { ArrowRight, CheckCircle, Clock, Edit3, FileText, RotateCcw, Send, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_LABELS, SENT_METHOD_LABELS, getNextStatus } from './types';
import type { Letter } from './types';

const STATUS_ICONS: Record<string, any> = {
  draft: Edit3,
  review: Clock,
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

            {status === 'pending_approval' && isReviewer && (
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import LetterEditor from '@/features/letters/components/LetterEditor';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUnsavedChangesGuard, type UnsavedLeaveTarget } from '@/features/letters/useUnsavedChangesGuard';
import { debugConsole } from '@/utils/debugConsole';
import type { LetterRecord } from '@/components/letter-pdf/types';
import { LETTER_EDIT_SELECT } from '@/features/letters/letterSelect';

const LetterDetail = () => {
  const { letterId } = useParams<{ letterId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();

  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState<LetterRecord | null>(null);
  // Verlassen der Seite nur nach Rückfrage, solange der Editor ungespeicherte Änderungen hat.
  const [isDirty, setIsDirty] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<UnsavedLeaveTarget | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  const fetchLetter = useCallback(async (): Promise<void> => {
    if (!letterId || !currentTenant) {
      setLetter(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letters')
        .select(LETTER_EDIT_SELECT)
        .eq('id', letterId)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setLetter((data as LetterRecord | null) ?? null);
    } catch (error: unknown) {
      debugConsole.error('Error fetching letter:', error);
      setLetter(null);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, letterId]);

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    void fetchLetter();
  }, [fetchLetter, user, authLoading, tenantLoading, navigate]);

  const handleBackToLetters = useCallback(() => {
    navigate('/documents?tab=letters');
  }, [navigate]);

  const navigateAway = useCallback((target: UnsavedLeaveTarget) => {
    // Guard vor dem Navigieren lösen, sonst fängt der popstate-Listener das eigene Zurück ab.
    setIsDirty(false);
    if (target === 'back') {
      window.history.go(-1);
      return;
    }
    navigate(target);
  }, [navigate]);

  const requestLeave = useCallback((target: UnsavedLeaveTarget) => {
    if (!isDirty) {
      navigateAway(target);
      return;
    }
    setPendingLeave(target);
  }, [isDirty, navigateAway]);

  const { keepOnPage } = useUnsavedChangesGuard({ dirty: isDirty, onLeaveRequest: requestLeave });

  const stayOnPage = useCallback(() => {
    setPendingLeave(null);
    keepOnPage();
  }, [keepOnPage]);

  const saveAndLeave = useCallback(async () => {
    const target = pendingLeave;
    setIsLeaving(true);
    const saved = saveRef.current ? await saveRef.current() : false;
    setIsLeaving(false);
    if (!saved) {
      // Fehlermeldung kommt aus dem Editor; Seite und Dialog bleiben stehen.
      stayOnPage();
      return;
    }
    setPendingLeave(null);
    if (target) navigateAway(target);
  }, [navigateAway, pendingLeave, stayOnPage]);

  if (authLoading || tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl mx-auto mt-12">
          <CardHeader>
            <CardTitle>Brief nicht gefunden</CardTitle>
            <CardDescription>
              Dieser Brief existiert nicht oder Sie haben keinen Zugriff darauf.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToLetters}>
              Zurück zu Briefen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto space-y-4">
        <Button variant="outline" onClick={() => requestLeave('/documents?tab=letters')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zu Briefen
        </Button>

        <LetterEditor
          letter={{
            ...letter,
            recipient_name: letter.recipient_name ?? undefined,
            recipient_address: letter.recipient_address ?? undefined,
          } as import('@/components/letters/types').Letter}
          isOpen
          // Der Editor hat beim Schließen bereits selbst nachgefragt.
          onClose={handleBackToLetters}
          // Nach dem Speichern nicht neu laden: das würde den Editor mitten im
          // Bearbeiten neu hydrieren. Die Seite lädt beim Zurückkehren ohnehin neu.
          onSave={() => undefined}
          onDirtyChange={setIsDirty}
          saveRef={saveRef}
        />
      </div>

      {/* Verlassen der Seite: Zurück-Knopf, interner Link oder Reload. */}
      <AlertDialog open={pendingLeave !== null} onOpenChange={(open) => { if (!open) stayOnPage(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Änderungen sind noch nicht gespeichert</AlertDialogTitle>
            <AlertDialogDescription>
              Beim Verlassen dieser Seite gehen die Änderungen am Brief verloren, wenn Sie sie nicht speichern.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving} onClick={stayOnPage}>Weiter bearbeiten</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isLeaving}
              onClick={() => { const target = pendingLeave; setPendingLeave(null); if (target) navigateAway(target); }}
            >
              Ohne Speichern verlassen
            </Button>
            <AlertDialogAction
              disabled={isLeaving}
              onClick={(event) => { event.preventDefault(); void saveAndLeave(); }}
            >
              {isLeaving ? 'Speichert…' : 'Speichern und verlassen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LetterDetail;

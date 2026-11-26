import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import LetterEditor from '@/features/letters/components/LetterEditor';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Button variant="outline" onClick={handleBackToLetters}>
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
          onClose={handleBackToLetters}
          // Nach dem Speichern nicht neu laden: das würde den Editor mitten im
          // Bearbeiten neu hydrieren. Die Seite lädt beim Zurückkehren ohnehin neu.
          onSave={() => undefined}
        />
      </div>
    </div>
  );
};

export default LetterDetail;

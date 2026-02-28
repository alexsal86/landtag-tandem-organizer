import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import LetterEditor from '@/components/LetterEditor';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LetterRecord {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  content_nodes?: any;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  template_id?: string;
  subject?: string;
  reference_number?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  letter_date?: string;
  status: 'draft' | 'review' | 'approved' | 'sent' | 'pending_approval' | 'revision_requested';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  show_pagination?: boolean;
}

const LetterDetail = () => {
  const { letterId } = useParams<{ letterId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();

  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState<LetterRecord | null>(null);

  const fetchLetter = async () => {
    if (!letterId || !currentTenant) return;

    setLoading(true);
    const { data } = await supabase
      .from('letters')
      .select('*')
      .eq('id', letterId)
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();

    setLetter((data as LetterRecord | null) || null);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchLetter();
  }, [letterId, currentTenant, user, authLoading, tenantLoading, navigate]);

  if (authLoading || tenantLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <Card className="max-w-2xl mx-auto mt-12">
          <CardHeader>
            <CardTitle>Brief nicht gefunden</CardTitle>
            <CardDescription>
              Dieser Brief existiert nicht oder Sie haben keinen Zugriff darauf.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/documents?tab=letters')}>
              Zurück zu Briefen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto space-y-4">
        <Button variant="outline" onClick={() => navigate('/documents?tab=letters')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zu Briefen
        </Button>

        <div className="h-[calc(100vh-7rem)]">
          <LetterEditor
            letter={letter as any}
            isOpen={true}
            onClose={() => navigate('/documents?tab=letters')}
            onSave={fetchLetter}
          />
        </div>
      </div>
    </div>
  );
};

export default LetterDetail;

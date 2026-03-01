import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ThemeProvider } from 'next-themes';
import LetterEditor from '@/components/LetterEditor';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppNavigation, getNavigationGroups } from '@/components/AppNavigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { SubNavigation } from '@/components/layout/SubNavigation';
import { MobileHeader } from '@/components/MobileHeader';
import { MobileSubNavigation } from '@/components/layout/MobileSubNavigation';

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
  const activeSection = 'documents';

  const navGroups = useMemo(() => getNavigationGroups(), []);
  const activeGroup = useMemo(() =>
    navGroups.find(g =>
      g.subItems?.some(item => item.id === activeSection) ||
      (g.route && g.route.slice(1) === activeSection) ||
      g.id === activeSection,
    ),
  [navGroups]);

  const handleSectionChange = (section: string) => {
    const path = section === 'dashboard' ? '/' : `/${section}`;
    navigate(path);
  };

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

  const renderMain = () => {
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
              <Button onClick={() => navigate('/documents?tab=letters')}>
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
          <Button variant="outline" onClick={() => navigate('/documents?tab=letters')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Briefen
          </Button>

          <div className="h-[calc(100vh-12rem)] min-h-[600px]">
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

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <div className="hidden md:block sticky top-0 h-screen z-30">
          <AppNavigation activeSection={activeSection} onSectionChange={handleSectionChange} />
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto h-screen">
          <div className="hidden md:block sticky top-0 z-40">
            <AppHeader />
            {activeGroup?.subItems && activeGroup.subItems.length > 1 ? (
              <SubNavigation
                items={activeGroup.subItems}
                activeItem={activeSection}
                onItemChange={handleSectionChange}
              />
            ) : null}
          </div>
          <MobileHeader />
          <div className="md:hidden">
            {activeGroup?.subItems && activeGroup.subItems.length > 1 ? (
              <MobileSubNavigation
                items={activeGroup.subItems}
                activeItem={activeSection}
                onItemChange={handleSectionChange}
              />
            ) : null}
          </div>
          <main id="main-content" className="flex-1 bg-gradient-to-b from-background to-muted/20" tabIndex={-1}>
            {renderMain()}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default LetterDetail;

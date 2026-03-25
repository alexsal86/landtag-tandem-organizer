import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { debugConsole } from '@/utils/debugConsole';
import type { LetterRecord } from '@/components/letter-pdf/types';

const LETTER_SELECT = 'id, title, content, content_html, content_nodes, recipient_name, recipient_address, contact_id, template_id, subject, reference_number, sender_info_id, information_block_ids, letter_date, status, sent_date, sent_method, expected_response_date, created_by, created_at, updated_at, tenant_id, show_pagination';

const LetterDetail = () => {
  const { letterId } = useParams<{ letterId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();

  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState<LetterRecord | null>(null);
  const activeSection = 'documents';

  const navGroups = useMemo(() => getNavigationGroups(), []);
  const activeGroup = useMemo(
    () => navGroups.find((group) =>
      group.subItems?.some((item) => item.id === activeSection)
      || (group.route && group.route.slice(1) === activeSection)
      || group.id === activeSection,
    ),
    [navGroups],
  );

  const handleSectionChange = useCallback((section: string) => {
    const path = section === 'dashboard' ? '/' : `/${section}`;
    navigate(path);
  }, [navigate]);

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
        .select(LETTER_SELECT)
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

          <div className="h-[calc(100vh-12rem)] min-h-[600px]">
            <LetterEditor
              letter={{
                ...letter,
                recipient_name: letter.recipient_name ?? undefined,
                recipient_address: letter.recipient_address ?? undefined,
              } as import('@/components/letters/types').Letter}
              isOpen
              onClose={handleBackToLetters}
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

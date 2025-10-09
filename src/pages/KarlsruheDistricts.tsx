import { useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Navigation } from '@/components/Navigation';
import { KarlsruheDistrictsView } from '@/components/karlsruhe/KarlsruheDistrictsView';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';

const KarlsruheDistricts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleSectionChange = (section: string) => {
    const path = section === 'dashboard' ? '/' : `/${section}`;
    navigate(path);
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Navigation 
            activeSection="stadtteile-karlsruhe" 
            onSectionChange={handleSectionChange} 
          />
          <main className="flex-1">
            <KarlsruheDistrictsView />
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default KarlsruheDistricts;

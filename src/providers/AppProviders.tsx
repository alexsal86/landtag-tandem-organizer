import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeadManager } from "@/components/AppHeadManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <AppSettingsProvider>
          <NotificationProvider>
            <TooltipProvider>
              <AppHeadManager />
              {children}
            </TooltipProvider>
          </NotificationProvider>
        </AppSettingsProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

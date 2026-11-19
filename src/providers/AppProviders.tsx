import { UserStatusProvider } from '@/hooks/useUserStatus';
import type { PropsWithChildren } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppHeadManager } from "@/components/navigation/AppHeadManager";

export const AppProviders = ({ children }: PropsWithChildren): React.JSX.Element => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <UserStatusProvider>
            <AppSettingsProvider>
              <NotificationProvider>
                <TooltipProvider>
                  <AppHeadManager />
                  {children}
                </TooltipProvider>
              </NotificationProvider>
            </AppSettingsProvider>
          </UserStatusProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

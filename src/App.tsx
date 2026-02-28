import { ReactNode, Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { GlobalSearchCommand } from "@/components/GlobalSearchCommand";
import { GlobalQuickNoteDialog } from "@/components/GlobalQuickNoteDialog";
import { GlobalDaySlipPanel } from "@/components/GlobalDaySlipPanel";
const Index = lazy(() => import("./pages/Index"));
const CreateTask = lazy(() => import("./pages/CreateTask"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
const EditContact = lazy(() => import("./pages/EditContact"));
const ImportContacts = lazy(() => import("./pages/ImportContacts"));
const PollGuest = lazy(() => import("./pages/PollGuest"));
const DecisionResponse = lazy(() => import("./pages/DecisionResponse"));
const GuestResponse = lazy(() => import("./pages/GuestResponse"));
const EventRSVP = lazy(() => import("./pages/EventRSVP"));
const AppointmentPreparationDetail = lazy(() => import("./pages/AppointmentPreparationDetail"));
const EmployeeMeetingDetail = lazy(() => import("./pages/EmployeeMeetingDetail"));
const TaskArchiveView = lazy(() =>
  import("./components/TaskArchiveView").then((module) => ({ default: module.TaskArchiveView })),
);
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MatrixClientProvider = lazy(() =>
  import("@/contexts/MatrixClientContext").then((module) => ({ default: module.MatrixClientProvider })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,      // 2 minutes – data stays fresh, no refetch
      gcTime: 10 * 60 * 1000,         // 10 minutes – cache kept in memory
      refetchOnWindowFocus: false,     // no auto-refetch on tab switch
      retry: 1,
    },
  },
});

// Inner component to use hooks
const shouldEnableMatrixProvider = (pathname: string) => {
  if (pathname.startsWith("/chat")) {
    return true;
  }

  if (pathname.startsWith("/administration")) {
    return true;
  }

  return false;
};

const MatrixProviderBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const matrixEnabled = shouldEnableMatrixProvider(location.pathname);

  if (!matrixEnabled) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-subtle flex items-center justify-center" />}>
      <MatrixClientProvider>{children}</MatrixClientProvider>
    </Suspense>
  );
};

const AppContent = () => {
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  // Global keyboard shortcut: Cmd/Ctrl + . (period)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setQuickNoteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MatrixProviderBoundary>
          <GlobalSearchCommand />
          <GlobalQuickNoteDialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen} />
          <GlobalDaySlipPanel />
          <Suspense
            fallback={<div className="min-h-screen bg-gradient-subtle flex items-center justify-center" />}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/mywork" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/contacts/new" element={<Navigate to="/contacts?action=new" replace />} />
              <Route path="/contacts/:id" element={<ContactDetail />} />
              <Route path="/contacts/:id/edit" element={<EditContact />} />
              <Route path="/tasks/new" element={<CreateTask />} />
              <Route path="/tasks/archive" element={<TaskArchiveView />} />
              <Route path="/contacts/import" element={<ImportContacts />} />

              <Route path="/maps" element={<Navigate to="/karten" replace />} />

              <Route path="/profile/edit" element={<Navigate to="/profile-edit" replace />} />
              <Route path="/poll-guest/:pollId" element={<PollGuest />} />
              <Route path="/decision-response/:participantId" element={<DecisionResponse />} />
              <Route path="/guest-response/:token" element={<GuestResponse />} />
              <Route path="/event-rsvp/:eventId" element={<EventRSVP />} />
              <Route path="/appointment-preparation" element={<AppointmentPreparationDetail />} />
              <Route path="/appointment-preparation/:id" element={<AppointmentPreparationDetail />} />
              {/* notifications is now handled by /:section in Index */}
              {/* editor-test route removed */}
              <Route path="/employee-meeting/:meetingId" element={<EmployeeMeetingDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="/:section/:subId" element={<Index />} />
              <Route path="/:section" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </MatrixProviderBoundary>
      </BrowserRouter>
      </>
    );
  };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <AppSettingsProvider>
          <NotificationProvider>
            <TooltipProvider>
              <AppContent />
            </TooltipProvider>
          </NotificationProvider>
        </AppSettingsProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

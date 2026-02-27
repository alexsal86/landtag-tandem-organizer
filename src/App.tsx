import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { MatrixClientProvider } from "@/contexts/MatrixClientContext";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { GlobalSearchCommand } from "@/components/GlobalSearchCommand";
import { GlobalQuickNoteDialog } from "@/components/GlobalQuickNoteDialog";
import { GlobalDaySlipPanel } from "@/components/GlobalDaySlipPanel";
import Index from "./pages/Index";
import CreateTask from "./pages/CreateTask";
import ContactDetail from "./pages/ContactDetail";
import EditContact from "./pages/EditContact";
import EditProfile from "./pages/EditProfile";
import ImportContacts from "./pages/ImportContacts";
import PollGuest from "./pages/PollGuest";
import DecisionResponse from "./pages/DecisionResponse";
import GuestResponse from "./pages/GuestResponse";
import EventRSVP from "./pages/EventRSVP";
import AppointmentPreparationDetail from "./pages/AppointmentPreparationDetail";

import NotificationsPage from "./pages/NotificationsPage";
import EmployeeMeetingDetail from "./pages/EmployeeMeetingDetail";

import { TaskArchiveView } from "./components/TaskArchiveView";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

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
        <GlobalSearchCommand />
        <GlobalQuickNoteDialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen} />
        <GlobalDaySlipPanel />
        <Routes>
          <Route path="/" element={<Navigate to="/mywork" replace />} />
          <Route path="/auth" element={<Auth />} />
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
            <MatrixClientProvider>
              <TooltipProvider>
                <AppContent />
              </TooltipProvider>
            </MatrixClientProvider>
          </NotificationProvider>
        </AppSettingsProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

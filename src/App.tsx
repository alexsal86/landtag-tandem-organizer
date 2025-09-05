import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import Index from "./pages/Index";
import CreateContact from "./pages/CreateContact";
import CreateAppointment from "./pages/CreateAppointment";
import CreateTask from "./pages/CreateTask";
import ContactDetail from "./pages/ContactDetail";
import EditContact from "./pages/EditContact";
import EditProfile from "./pages/EditProfile";
import CreateDistributionList from "./pages/CreateDistributionList";
import EditDistributionList from "./pages/EditDistributionList";
import ImportContacts from "./pages/ImportContacts";
import PollGuest from "./pages/PollGuest";
import DecisionResponse from "./pages/DecisionResponse";
import GuestResponse from "./pages/GuestResponse";
import AppointmentPreparationDetail from "./pages/AppointmentPreparationDetail";

import { TaskArchiveView } from "./components/TaskArchiveView";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/calendar" element={<Index />} />
            <Route path="/contacts" element={<Index />} />
            <Route path="/tasks" element={<Index />} />
            <Route path="/meetings" element={<Index />} />
            <Route path="/eventplanning" element={<Index />} />
            <Route path="/documents" element={<Index />} />
            <Route path="/knowledge" element={<Index />} />
            <Route path="/knowledge/:documentId" element={<Index />} />
            <Route path="/settings" element={<Index />} />
            <Route path="/time" element={<Index />} />
            <Route path="/employee" element={<Index />} />
            <Route path="/administration" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/contacts/new" element={<CreateContact />} />
            <Route path="/contacts/import" element={<ImportContacts />} />
            <Route path="/appointments/new" element={<CreateAppointment />} />
            <Route path="/tasks/new" element={<CreateTask />} />
            
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/contacts/:id/edit" element={<EditContact />} />
            <Route path="/distribution-lists/new" element={<CreateDistributionList />} />
            <Route path="/distribution-lists/:id/edit" element={<EditDistributionList />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/poll-guest/:pollId" element={<PollGuest />} />
            <Route path="/decision-response/:participantId" element={<DecisionResponse />} />
            <Route path="/guest-response/:token" element={<GuestResponse />} />
            <Route path="/appointment-preparation/:id" element={<AppointmentPreparationDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
          </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

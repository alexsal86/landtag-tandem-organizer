import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { CollaborationProvider } from "@/contexts/CollaborationContext";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load components for better code splitting
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const CreateContact = React.lazy(() => import("./pages/CreateContact"));
const CreateAppointment = React.lazy(() => import("./pages/CreateAppointment"));
const CreateTask = React.lazy(() => import("./pages/CreateTask"));
const ContactDetail = React.lazy(() => import("./pages/ContactDetail"));
const EditContact = React.lazy(() => import("./pages/EditContact"));
const EditProfile = React.lazy(() => import("./pages/EditProfile"));
const CreateDistributionList = React.lazy(() => import("./pages/CreateDistributionList"));
const EditDistributionList = React.lazy(() => import("./pages/EditDistributionList"));
const ImportContacts = React.lazy(() => import("./pages/ImportContacts"));
const PollGuest = React.lazy(() => import("./pages/PollGuest"));
const DecisionResponse = React.lazy(() => import("./pages/DecisionResponse"));

// Import React for lazy loading
import React from "react";

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <CollaborationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
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
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CollaborationProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import CreateContact from "./pages/CreateContact";
import CreateAppointment from "./pages/CreateAppointment";
import CreateTask from "./pages/CreateTask";
import ContactDetail from "./pages/ContactDetail";
import EditContact from "./pages/EditContact";
import EditProfile from "./pages/EditProfile";
import RoleManagement from "./pages/RoleManagement";
import { TaskArchiveView } from "./components/TaskArchiveView";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/contacts/new" element={<CreateContact />} />
            <Route path="/appointments/new" element={<CreateAppointment />} />
            <Route path="/tasks/new" element={<CreateTask />} />
            
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/contacts/:id/edit" element={<EditContact />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/admin/rechte" element={<RoleManagement />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

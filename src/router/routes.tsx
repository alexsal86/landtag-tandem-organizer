import { Navigate, Route } from "react-router-dom";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ProtectedRoute } from "./ProtectedRoute";

const Index = lazyWithRetry(() => import("@/pages/Index"));
const CreateTask = lazyWithRetry(() => import("@/pages/CreateTask"));
const ContactDetail = lazyWithRetry(() => import("@/pages/ContactDetail"));
const EditContact = lazyWithRetry(() => import("@/pages/EditContact"));
const ImportContacts = lazyWithRetry(() => import("@/pages/ImportContacts"));
const PollGuest = lazyWithRetry(() => import("@/pages/PollGuest"));
const DecisionResponse = lazyWithRetry(() => import("@/pages/DecisionResponse"));
const GuestResponse = lazyWithRetry(() => import("@/pages/GuestResponse"));
const EventRSVP = lazyWithRetry(() => import("@/pages/EventRSVP")); // Legacy-Kompatibilitätspfad für bereits versandte Einladungen
const LegacyEventRSVPRedirect = lazyWithRetry(() => import("@/pages/LegacyEventRSVPRedirect")); // Legacy-Alias; erst entfernen, wenn keine Altlinks mehr im Umlauf sind
const EmployeeMeetingDetail = lazyWithRetry(() => import("@/pages/EmployeeMeetingDetail"));
const LetterDetail = lazyWithRetry(() => import("@/pages/LetterDetail"));
const CaseItemDetail = lazyWithRetry(() =>
  import("@/features/cases/items/pages").then((m) => ({ default: m.CaseItemDetail }))
);
const TaskArchiveView = lazyWithRetry(() =>
  import("@/features/tasks/components/TaskArchiveView").then((module) => ({ default: module.TaskArchiveView }))
);
const Auth = lazyWithRetry(() => import("@/pages/Auth"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));

export const AppRoutes = () => (
  <>
    {/* Öffentliche Routen – kein Login erforderlich */}
    <Route path="/auth" element={<Auth />} />
    <Route path="/poll-guest/:pollId" element={<PollGuest />} />
    <Route path="/decision-response/:participantId" element={<DecisionResponse />} />
    <Route path="/guest-response/:token" element={<GuestResponse />} />
    <Route path="/einladung/:code" element={<EventRSVP />} /> {/* Legacy-Pfad: neue Einladungen ab sofort über alexander-salomon.de, Altlinks bleiben vorerst gültig. */}
    <Route path="/event-rsvp/:eventId" element={<LegacyEventRSVPRedirect />} /> {/* Nicht entfernen, solange Altlinks aus früheren Mailings noch aktiv sein können. */}

    {/* Geschützte Routen – Weiterleitung zu /auth wenn nicht eingeloggt */}
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<Navigate to="/mywork" replace />} />
      <Route path="/contacts/new" element={<Navigate to="/contacts?action=new" replace />} />
      <Route path="/contacts/netzwerk" element={<Index />} />
      <Route path="/contacts/stakeholder" element={<Index />} />
      <Route path="/contacts/:id" element={<ContactDetail />} />
      <Route path="/contacts/:id/edit" element={<EditContact />} />
      <Route path="/tasks/new" element={<CreateTask />} />
      <Route path="/tasks/archive" element={<TaskArchiveView />} />
      <Route path="/contacts/import" element={<ImportContacts />} />
      <Route path="/maps" element={<Navigate to="/karten" replace />} />
      <Route path="/profile/edit" element={<Navigate to="/profile-edit" replace />} />
      <Route path="/letters/:letterId" element={<LetterDetail />} />
      <Route path="/vorgaenge/:caseItemId" element={<CaseItemDetail />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="/:section/:subId" element={<Index />} />
      <Route path="/:section" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </>
);

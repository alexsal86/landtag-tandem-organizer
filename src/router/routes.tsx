import { Navigate, Outlet, Route, useLocation, useParams } from "react-router-dom";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ProtectedRoute } from "./ProtectedRoute";
import { WorkspaceToolbar } from "@/components/layout/WorkspaceToolbar";

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
const CaseItemDetail = lazyWithRetry(() =>
  import("@/features/cases/items/pages").then((m) => ({ default: m.CaseItemDetail }))
);
const TaskArchiveView = lazyWithRetry(() =>
  import("@/features/tasks/components/TaskArchiveView").then((module) => ({ default: module.TaskArchiveView }))
);
const Auth = lazyWithRetry(() => import("@/pages/Auth"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));

function TaskWorkspaceRedirect() {
  const { search, hash } = useLocation();
  const { taskId } = useParams();
  const params = new URLSearchParams(search);
  const linkedTask = params.get("task") || params.get("id") || taskId;

  if (linkedTask) params.set("task", linkedTask);
  params.delete("id");

  return <Navigate to={{ pathname: "/tasks", search: `?${params}`, hash }} replace />;
}

function CasesRedirect() {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  const legacyFileId = params.get("tab") === "files" ? params.get("id") : null;

  if (legacyFileId) {
    params.delete("tab");
    params.delete("id");
    params.set("caseFileId", legacyFileId);
    return <Navigate to={{ pathname: "/casefiles", search: `?${params}`, hash }} replace />;
  }

  params.set("tab", "cases");
  return <Navigate to={{ pathname: "/mywork", search: `?${params}`, hash }} replace />;
}

function LegacyCaseItemRedirect() {
  const { caseItemId } = useParams<"caseItemId">();
  const { search, hash } = useLocation();

  if (!caseItemId) return <CasesRedirect />;

  return <Navigate to={{ pathname: `/vorgaenge/${encodeURIComponent(caseItemId)}`, search, hash }} replace />;
}

/** Redaktion lives inside "Meine Arbeit"; agenda, reminders and approval notifications link to /redaktion. */
function RedaktionRedirect() {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  params.set("tab", "redaktion");

  return <Navigate to={{ pathname: "/mywork", search: `?${params.toString()}`, hash }} replace />;
}

function FeatureCatalogRedirect() {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  params.set("adminSection", "superadmin");
  params.set("adminSubSection", "feature-catalog");
  return <Navigate to={{ pathname: "/administration", search: params.toString(), hash }} replace />;
}

function StandaloneWorkspace() {
  return (
    <>
      <header className="sticky top-0 z-40 bg-background">
        <WorkspaceToolbar />
      </header>
      <Outlet />
    </>
  );
}

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
      <Route path="/dashboard/*" element={<Navigate to="/mywork?tab=dashboard" replace />} />
      <Route path="/contacts/new" element={<Navigate to="/contacts?action=new" replace />} />
      <Route element={<StandaloneWorkspace />}>
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/contacts/:id/edit" element={<EditContact />} />
        <Route path="/tasks/new" element={<CreateTask />} />
        <Route path="/tasks/archive" element={<TaskArchiveView />} />
        <Route path="/contacts/import" element={<ImportContacts />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/contacts/netzwerk" element={<Index />} />
      <Route path="/contacts/stakeholder" element={<Index />} />
      <Route path="/tasks" element={<Index />} />
      <Route path="/tasks/:taskId" element={<TaskWorkspaceRedirect />} />
      <Route path="/maps" element={<Navigate to="/karten" replace />} />
      <Route path="/profile/edit" element={<Navigate to="/profile-edit" replace />} />
      <Route path="/letters/:letterId" element={<Index />} />
      <Route path="/notes" element={<Index />} />
      <Route path="/vorgaenge" element={<CasesRedirect />} />
      <Route path="/cases" element={<CasesRedirect />} />
      <Route path="/cases/:caseItemId" element={<LegacyCaseItemRedirect />} />
      <Route path="/vorgaenge/:caseItemId" element={<CaseItemDetail />} />
      <Route path="/redaktion" element={<RedaktionRedirect />} />
      <Route path="/funktionskatalog" element={<FeatureCatalogRedirect />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="/:section/:subId" element={<Index />} />
      <Route path="/:section" element={<Index />} />
    </Route>
  </>
);

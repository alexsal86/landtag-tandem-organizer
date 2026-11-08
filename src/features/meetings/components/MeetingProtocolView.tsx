import { ProtocolHeader } from "./protocol/ProtocolHeader";
import { ProtocolSummary } from "./protocol/ProtocolSummary";
import { ProtocolToc } from "./protocol/ProtocolToc";
import { ProtocolDecisions } from "./protocol/ProtocolDecisions";
import { ProtocolNotes } from "./protocol/ProtocolNotes";
import { ProtocolAppointments } from "./protocol/ProtocolAppointments";
import { ProtocolTasks } from "./protocol/ProtocolTasks";
import { ProtocolAgendaEntry } from "./protocol/ProtocolAgendaItem";
import { parseMeetingResults } from "@/components/meetings/platformAgendaRules";
import { systemAgendaOption } from "@/components/meetings/systemAgendaRegistry";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Printer,
  Scale,
  StickyNote,
  Briefcase,
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { notify } from "@/lib/notify";

import type {
  ProtocolAgendaItem,
  ProtocolMeeting,
  Profile,
  StarredAppointment,
  ProtocolQuickNote,
  ProtocolCaseItem,
  ProtocolDecision,
  ProtocolParticipant,
  CreatedTask,
} from "./protocol/types";

interface MeetingProtocolViewProps {
  meetingId: string;
  onBack: () => void;
  /** When true, shows "Zurück zur Übersicht" instead of "Zurück zum Archiv" */
  isPostArchive?: boolean;
}

export function MeetingProtocolView({
  meetingId,
  onBack,
  isPostArchive,
}: MeetingProtocolViewProps) {
  const [meeting, setMeeting] = useState<ProtocolMeeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<ProtocolAgendaItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [starredAppointments, setStarredAppointments] = useState<
    StarredAppointment[]
  >([]);
  const [participants, setParticipants] = useState<ProtocolParticipant[]>([]);
  const [quickNotes, setQuickNotes] = useState<ProtocolQuickNote[]>([]);
  const [caseItems, setCaseItems] = useState<ProtocolCaseItem[]>([]);
  const [decisions, setDecisions] = useState<ProtocolDecision[]>([]);
  const [createdTasks, setCreatedTasks] = useState<CreatedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyResults, setOnlyResults] = useState(false);
  const [activeSection, setActiveSection] = useState("protocol-agenda");
  useEffect(() => {
    if (loading) return;
    const update = () => {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-protocol-document] section[id]",
        ),
      );
      let current = headings[0]?.id ?? "protocol-agenda";
      for (const heading of headings)
        if (heading.getBoundingClientRect().top <= 140) current = heading.id;
      setActiveSection(current);
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [loading, onlyResults, meetingId]);

  useEffect(() => {
    loadMeetingProtocol();
  }, [meetingId]);

  const loadMeetingProtocol = async () => {
    try {
      setLoading(true);

      // Load meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select(
          "id, title, description, meeting_date, meeting_time, location, status, user_id, tenant_id",
        )
        .eq("id", meetingId)
        .single();
      if (meetingError) throw meetingError;

      // Load agenda items with hierarchy fields
      const { data: agendaData, error: agendaError } = await supabase
        .from("meeting_agenda_items")
        .select(
          "id, title, description, notes, result_text, assigned_to, order_index, parent_id, system_type, is_completed, task_id",
        )
        .eq("meeting_id", meetingId)
        .order("order_index");
      if (agendaError) throw agendaError;

      // Load all profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("tenant_id", meetingData.tenant_id);

      // Load participants
      const { data: participantsData } = await supabase
        .from("meeting_participants")
        .select("user_id, role")
        .eq("meeting_id", meetingId);

      const participantList: ProtocolParticipant[] = [];
      // Add creator
      if (meetingData?.user_id) {
        const creatorProfile = profilesData?.find(
          (p) => p.user_id === meetingData.user_id,
        );
        participantList.push({
          user_id: meetingData.user_id,
          role: "organizer",
          display_name: creatorProfile?.display_name || "Unbekannt",
        });
      }
      // Add participants (avoid duplicates with creator)
      for (const p of participantsData || []) {
        if (p.user_id === meetingData?.user_id) continue;
        const profile = profilesData?.find(
          (pr) => pr.user_id === p.user_id,
        );
        participantList.push({
          user_id: p.user_id,
          role: p.role,
          display_name: profile?.display_name || "Unbekannt",
        });
      }

      // Load quick notes linked to this meeting with results
      const { data: notesData } = await supabase
        .from("quick_notes")
        .select("id, title, content, meeting_result, category")
        .eq("meeting_id", meetingId);

      // Load case items linked via agenda items with system_type='case_items'
      const caseItemAgendaItems = (
        (agendaData || []) as ProtocolAgendaItem[]
      ).filter(
        (item) => item.system_type === "case_items" && item.result_text?.trim(),
      );
      // We'll display them from agenda items directly

      // Load decisions linked via agenda items with system_type='decisions'
      const decisionAgendaItems = (
        (agendaData || []) as ProtocolAgendaItem[]
      ).filter((item) => item.system_type === "decisions");
      const decisionList: ProtocolDecision[] = [];
      const resultById = Object.assign(
        {},
        ...decisionAgendaItems.map((item) =>
          parseMeetingResults(item.result_text),
        ),
      ) as ReturnType<typeof parseMeetingResults>;
      const decisionIds = Object.keys(resultById).filter((id) =>
        /^[0-9a-f-]{36}$/i.test(id),
      );
      if (decisionIds.length) {
        const { data: decisionsData, error } = await supabase
          .from("task_decisions")
          .select("id, title, status, response_deadline, meeting_result")
          .eq("tenant_id", meetingData.tenant_id)
          .in("id", decisionIds);
        if (error) throw error;
        for (const decision of decisionsData ?? [])
          decisionList.push({
            ...decision,
            result_text:
              resultById[decision.id]?.result || decision.meeting_result,
          });
      }
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, assigned_to, parent_task_id")
        .eq("tenant_id", meetingData.tenant_id)
        .eq("meeting_id", meetingId)
        .like("source_type", "jour_fixe_%")
        .limit(200);
      if (tasksError) throw tasksError;

      // Load starred appointments
      const starredList: StarredAppointment[] = [];
      const { data: starredData } = await supabase
        .from("starred_appointments")
        .select("id, appointment_id, external_event_id")
        .eq("meeting_id", meetingId);

      if (starredData && starredData.length > 0) {
        const appointmentIds = starredData
          .filter((s) => s.appointment_id)
          .map((s) => s.appointment_id!);
        const externalEventIds = starredData
          .filter((s) => s.external_event_id)
          .map((s) => s.external_event_id!);

        if (appointmentIds.length > 0) {
          const { data: appointments } = await supabase
            .from("appointments")
            .select("id, title, start_time")
            .in("id", appointmentIds);
          if (appointments) starredList.push(...appointments);
        }
        if (externalEventIds.length > 0) {
          const { data: externalEvents } = await supabase
            .from("external_events")
            .select("id, title, start_time")
            .in("id", externalEventIds);
          if (externalEvents) starredList.push(...externalEvents);
        }
      }

      setMeeting(meetingData as ProtocolMeeting);
      setAgendaItems((agendaData || []) as ProtocolAgendaItem[]);
      setProfiles((profilesData || []) as Profile[]);
      setParticipants(participantList);
      setQuickNotes((notesData || []) as ProtocolQuickNote[]);
      setDecisions(decisionList);
      setCreatedTasks((tasksData || []) as CreatedTask[]);
      setStarredAppointments(starredList);
    } catch (error) {
      debugConsole.error("Error loading meeting protocol:", error);
      notify.error("Fehler", {
        description: "Das Besprechungsprotokoll konnte nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAssignedUserNames = (userIds?: string[] | null) => {
    if (!userIds || userIds.length === 0) return null;
    return userIds
      .map((userId) => {
        const profile = profiles.find((p) => p.user_id === userId);
        return profile?.display_name || "Unbekannter Benutzer";
      })
      .join(", ");
  };

  const handlePrint = () => {
    window.print();
  };

  // Build hierarchical agenda
  const mainItems = agendaItems
    .filter((i) => !i.parent_id)
    .sort((a, b) => a.order_index - b.order_index);
  const getChildren = (parentId: string) =>
    agendaItems
      .filter((i) => i.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index);

  const getSystemIcon = (systemType?: string | null) => {
    switch (systemType) {
      case "decisions":
        return <Scale className="h-4 w-4 text-palette-violet" />;
      case "quick_notes":
        return <StickyNote className="h-4 w-4 text-palette-amber" />;
      case "tasks":
        return <CheckSquare className="h-4 w-4 text-palette-blue" />;
      case "case_items":
        return <Briefcase className="h-4 w-4 text-palette-green" />;
      case "birthdays":
        return <span className="text-base">🎂</span>;
      case "upcoming_appointments":
        return <Calendar className="h-4 w-4 text-palette-orange" />;
      default: {
        const Icon = systemAgendaOption(systemType)?.Icon;
        return Icon ? <Icon className="h-4 w-4 text-primary" /> : null;
      }
    }
  };

  const roleLabelMap: Record<string, string> = {
    organizer: "Organisator",
    participant: "Teilnehmer",
    optional: "Optional",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">
          Lade Besprechungsprotokoll...
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center space-y-4">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">Besprechung nicht gefunden</h3>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>
    );
  }

  const backLabel = isPostArchive
    ? "Zurück zur Übersicht"
    : "Zurück zum Archiv";
  const notesWithResults = quickNotes.filter((n) => n.meeting_result?.trim());
  const parentTasks = createdTasks.filter((t) => !t.parent_task_id);

  const sections = [
    ...(mainItems.length
      ? [{ id: "protocol-agenda", label: "Tagesordnung" }]
      : []),
    ...(decisions.length
      ? [{ id: "protocol-decisions", label: "Entscheidungen" }]
      : []),
    ...(notesWithResults.length
      ? [{ id: "protocol-notes", label: "Notizen" }]
      : []),
    ...(starredAppointments.length
      ? [{ id: "protocol-appointments", label: "Termine" }]
      : []),
    ...(parentTasks.length
      ? [{ id: "protocol-tasks", label: "Aufgaben" }]
      : []),
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6 print:max-w-none print:p-0 print:bg-white print:text-black">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
        <div
          className="ml-auto inline-flex rounded-lg border bg-card"
          role="group"
          aria-label="Protokollumfang"
        >
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={!onlyResults}
            className={!onlyResults ? "bg-primary/10" : ""}
            onClick={() => setOnlyResults(false)}
          >
            Alles
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={onlyResults}
            className={onlyResults ? "bg-primary/10" : ""}
            onClick={() => setOnlyResults(true)}
          >
            Nur Ergebnisse
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Drucken
        </Button>
      </div>
      <div className="grid grid-cols-1 min-[860px]:grid-cols-[170px_minmax(0,1fr)] gap-7 items-start print:block">
        <ProtocolToc sections={sections} activeSection={activeSection} />
        <article
          data-protocol-document
          className="min-w-0 rounded-xl border bg-card p-5 sm:p-9 print:border-0 print:rounded-none print:shadow-none print:bg-white print:text-black print:p-0"
        >
          <ProtocolHeader
            meeting={meeting}
            participants={participants}
            roleLabelMap={roleLabelMap}
          />
          <ProtocolSummary
            points={mainItems.length}
            decisions={decisions.length}
            openDecisions={
              decisions.filter((decision) => decision.status !== "decided")
                .length
            }
            tasks={createdTasks.length}
          />
          <section
            id="protocol-agenda"
            className="scroll-mt-6 mt-8 border-t pt-6"
          >
            <h2 className="mb-3 text-lg font-semibold print:break-after-avoid">
              Tagesordnung und Ergebnisse
            </h2>
            {!mainItems.length ? (
              <p className="py-8 text-center text-muted-foreground">
                Keine Tagesordnungspunkte verfügbar.
              </p>
            ) : (
              <div>
                {mainItems.map((item, index) => (
                  <ProtocolAgendaEntry
                    key={item.id}
                    item={item}
                    number={`${index + 1}.`}
                    onlyResults={onlyResults}
                    getChildren={getChildren}
                    getAssignedUserNames={getAssignedUserNames}
                    getSystemIcon={getSystemIcon}
                  />
                ))}
              </div>
            )}
          </section>
          <ProtocolDecisions decisions={decisions} />
          <ProtocolNotes notesWithResults={notesWithResults} />
          <ProtocolAppointments starredAppointments={starredAppointments} />
          <ProtocolTasks
            parentTasks={parentTasks}
            createdTasks={createdTasks}
            getAssignedUserNames={getAssignedUserNames}
          />
          <footer className="mt-9 border-t pt-4 text-sm text-muted-foreground">
            <p>
              Protokoll erstellt am{" "}
              {format(new Date(), "PPP 'um' HH:mm 'Uhr'", { locale: de })}
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

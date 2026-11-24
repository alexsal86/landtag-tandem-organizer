import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format, isWeekend, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useResolvedUserRole, type ResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { getRoleFlags } from "@/components/my-work/tabVisibility";
import {
  calculateWeeklyTarget,
  WEEK_TARGET_ABSENCE_TYPES,
  type PublicHolidayRow,
  type WeeklyAbsence,
  type WeeklyTargetResult,
} from "@/features/timetracking/weeklyTarget";
import { debugConsole } from "@/utils/debugConsole";

export type TeamViewerRole = ResolvedUserRole;

interface TeamProfileRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  badge_color?: string | null;
}

interface TeamSettingsRow {
  user_id: string;
  hours_per_week: number | null;
  days_per_week: number | null;
  workdays: boolean[] | null;
  last_meeting_date: string | null;
  meeting_interval_months: number | null;
}

interface TeamMeetingRequestRow {
  employee_id: string;
}

interface TeamTimeEntryRow {
  user_id: string;
  minutes: number;
  work_date: string;
}

interface LatestTimeEntryRow {
  user_id: string;
  last_work_date: string | null;
}

interface TeamAbsenceRow extends WeeklyAbsence {
  user_id: string;
}

export interface TeamDataIssues {
  memberships: boolean;
  profiles: boolean;
  settings: boolean;
  meetingRequests: boolean;
  timeEntries: boolean;
  latestEntries: boolean;
  absences: boolean;
  holidays: boolean;
}

interface RawTeamMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  badgeColor?: string | null;
  hoursPerWeek: number;
  daysPerWeek: number;
  /** Monday-first individual workday plan. */
  workdays: boolean[];
  lastMeetingDate: string | null;
  nextMeetingDue: string | null;
  openMeetingRequests: number;
  weeklyWorkedMinutes: number;
  weeklyTargetMinutes: number;
  weeklyAbsenceDays: number;
  lastTimeEntryDate: string | null;
  daysWithoutEntry: number | null;
}

export interface TeamTabAccessRule {
  role: TeamViewerRole;
  label: string;
  reason: string;
}

export type WorkIndicatorVariant = "empty" | "critical" | "warning" | "progress" | "good" | "overtime";

export interface TeamWorkStatusViewModel {
  workedHoursLabel: string;
  targetHoursLabel: string;
  indicatorVariant: WorkIndicatorVariant;
  indicatorLabel: string;
  lastTimeEntryDate: string | null;
  daysWithoutEntry: number | null;
  needsAttention: boolean;
}

export interface TeamMemberViewModel extends RawTeamMember {
  initials: string;
  workStatus: TeamWorkStatusViewModel;
  meetingStatus: {
    label: string;
    variant: "destructive" | "secondary";
  } | null;
}

export interface TeamOverviewMetrics {
  totalMembers: number;
  pendingMeetingRequests: number;
  overdueMeetings: number;
  membersWithoutRecentEntries: number;
}

export interface UseMyWorkTeamDataModel {
  canViewTeam: boolean;
  userRole: TeamViewerRole;
  teamMembers: TeamMemberViewModel[];
  overview: TeamOverviewMetrics;
  /** True per data source that could not be loaded, so the UI can show it instead of zeros. */
  issues: TeamDataIssues;
}

export interface UseMyWorkTeamDataResult extends UseMyWorkTeamDataModel {
  data: UseMyWorkTeamDataModel;
  isLoading: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  reload: () => Promise<unknown>;
}

export const EMPTY_TEAM_DATA_ISSUES: TeamDataIssues = {
  memberships: false,
  profiles: false,
  settings: false,
  meetingRequests: false,
  timeEntries: false,
  latestEntries: false,
  absences: false,
  holidays: false,
};

export const TEAM_DATA_ISSUE_LABELS: Record<keyof TeamDataIssues, string> = {
  memberships: "Die Teammitglieder konnten nicht geladen werden.",
  profiles: "Profile konnten nicht geladen werden – Namen und Bilder fehlen.",
  settings: "Mitarbeitereinstellungen konnten nicht geladen werden – 40 h/Woche und 5 Tage werden angenommen.",
  meetingRequests: "Offene Gesprächsanfragen konnten nicht geladen werden.",
  timeEntries: "Zeiteinträge dieser Woche konnten nicht geladen werden.",
  latestEntries: "Die letzten Zeiteinträge konnten nicht geladen werden.",
  absences: "Urlaubs- und Krankheitstage konnten nicht geladen werden – das Soll kann zu hoch sein.",
  holidays: "Feiertage konnten nicht geladen werden – das Soll kann zu hoch sein.",
};

export function describeTeamDataIssues(issues: TeamDataIssues): string[] {
  return (Object.keys(TEAM_DATA_ISSUE_LABELS) as Array<keyof TeamDataIssues>)
    .filter((key) => issues[key])
    .map((key) => TEAM_DATA_ISSUE_LABELS[key]);
}

const TEAM_TAB_ACCESS_COPY: TeamTabAccessRule[] = [
  {
    role: "abgeordneter",
    label: "Abgeordnete",
    reason: "sehen den Team-Tab, weil sie Mitarbeitergespräche, Meeting-Anfragen und Zeiterfassung verantworten.",
  },
  {
    role: "bueroleitung",
    label: "Büroleitung",
    reason: "sehen den Team-Tab, weil sie den operativen Überblick über Mitarbeiterinnen und Mitarbeiter benötigen.",
  },
];

/** The visible roles are derived from the central role flags in tabVisibility. */
export const TEAM_TAB_ACCESS_RULES = TEAM_TAB_ACCESS_COPY.filter(({ role }) => getRoleFlags(role).canViewTeam);

const TEAM_MEMBER_ROLES = new Set<TeamViewerRole>(["mitarbeiter", "praktikant", "bueroleitung"]);
const TIME_ENTRY_ATTENTION_THRESHOLD_DAYS = 3;
const EMPTY_OVERVIEW: TeamOverviewMetrics = {
  totalMembers: 0,
  pendingMeetingRequests: 0,
  overdueMeetings: 0,
  membersWithoutRecentEntries: 0,
};

export function calculateBusinessDaysSince(lastDate: string | null, today = new Date()): number | null {
  if (!lastDate) return null;

  const last = new Date(lastDate);
  let count = 0;
  const current = new Date(last);
  current.setDate(current.getDate() + 1);

  while (current <= today) {
    if (!isWeekend(current)) count++;
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export function getMeetingStatus(nextDue: string | null): TeamMemberViewModel["meetingStatus"] {
  if (!nextDue) return null;

  const daysUntil = differenceInDays(new Date(nextDue), new Date());
  if (daysUntil < 0) return { label: "Überfällig", variant: "destructive" };
  if (daysUntil <= 14) return { label: "Bald fällig", variant: "secondary" };
  return null;
}

export function getWorkIndicatorMeta(worked: number, target: number) {
  const percentage = target > 0 ? (worked / target) * 100 : 0;

  if (worked === 0) return { variant: "empty" as const, label: "Keine Einträge", percentage };
  if (percentage < 25) return { variant: "critical" as const, label: "Wenig erfasst", percentage };
  if (percentage < 50) return { variant: "warning" as const, label: "Untererfasst", percentage };
  if (percentage < 80) return { variant: "progress" as const, label: "In Arbeit", percentage };
  if (percentage <= 100) return { variant: "good" as const, label: "Gut erfasst", percentage };
  return { variant: "overtime" as const, label: "Überstunden", percentage };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

async function resolveViewerRole(userId: string, tenantId: string): Promise<TeamViewerRole> {
  const { data, error } = await supabase
    .from("user_tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    debugConsole.error("Error resolving team viewer role:", error);
    throw new Error("Die eigene Rolle im Büro konnte nicht geladen werden.");
  }

  return ((data as { role?: TeamViewerRole } | null)?.role ?? null) as TeamViewerRole;
}

async function resolveVisibleEmployeeIds(
  userId: string,
  tenantId: string,
): Promise<{ employeeIds: string[]; membershipsFailed: boolean }> {
  const { data: memberships, error: membershipsError } = await supabase
    .from("user_tenant_memberships")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (membershipsError) {
    debugConsole.error("Error loading tenant memberships for team:", membershipsError);
  }

  const membershipIds = ((memberships as { user_id: string; role: TeamViewerRole }[] | null) ?? [])
    .filter((membership) => TEAM_MEMBER_ROLES.has(membership.role))
    .map((membership) => membership.user_id);

  if (membershipIds.length > 0) {
    return { employeeIds: Array.from(new Set(membershipIds)), membershipsFailed: false };
  }

  const { data: managedEmployees, error: managedEmployeesError } = await supabase
    .from("employee_settings")
    .select("user_id")
    .eq("admin_id", userId);

  if (managedEmployeesError) {
    debugConsole.error("Error loading fallback managed employees:", managedEmployeesError);
  }

  return {
    employeeIds: Array.from(new Set(((managedEmployees as { user_id: string }[] | null) ?? []).map((row) => row.user_id))),
    membershipsFailed: Boolean(membershipsError),
  };
}

function buildTeamWorkStatus(
  workedMinutes: number,
  target: WeeklyTargetResult,
  lastTimeEntryDate: string | null,
  today: Date,
): TeamWorkStatusViewModel {
  const indicator = getWorkIndicatorMeta(workedMinutes, target.targetMinutes);
  const daysWithoutEntry = calculateBusinessDaysSince(lastTimeEntryDate, today);

  return {
    workedHoursLabel: (workedMinutes / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 }),
    targetHoursLabel: (target.targetMinutes / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 }),
    indicatorVariant: indicator.variant,
    indicatorLabel: indicator.label,
    lastTimeEntryDate,
    daysWithoutEntry,
    needsAttention: daysWithoutEntry === null || daysWithoutEntry > TIME_ENTRY_ATTENTION_THRESHOLD_DAYS,
  };
}

interface MapTeamMembersInput {
  employeeIds: string[];
  profiles: TeamProfileRow[];
  settings: TeamSettingsRow[];
  requests: TeamMeetingRequestRow[];
  weekEntries: TeamTimeEntryRow[];
  latestEntries: LatestTimeEntryRow[];
  absences: TeamAbsenceRow[];
  holidays: PublicHolidayRow[];
  weekStart: string;
  today: string;
}

function mapTeamMembers({
  employeeIds,
  profiles,
  settings,
  requests,
  weekEntries,
  latestEntries,
  absences,
  holidays,
  weekStart,
  today,
}: MapTeamMembersInput): TeamMemberViewModel[] {
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const settingsMap = new Map(settings.map((setting) => [setting.user_id, setting]));

  const requestCounts = requests.reduce<Record<string, number>>((acc, request) => {
    acc[request.employee_id] = (acc[request.employee_id] ?? 0) + 1;
    return acc;
  }, {});

  const weeklyMinutes = weekEntries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.user_id] = (acc[entry.user_id] ?? 0) + entry.minutes;
    return acc;
  }, {});

  const lastTimeEntryThisWeek = weekEntries.reduce<Record<string, string>>((acc, entry) => {
    if (!acc[entry.user_id] || entry.work_date > acc[entry.user_id]) {
      acc[entry.user_id] = entry.work_date;
    }
    return acc;
  }, {});

  const lastGlobalEntry = latestEntries.reduce<Record<string, string | null>>((acc, entry) => {
    acc[entry.user_id] = entry.last_work_date;
    return acc;
  }, {});

  const absencesByUser = absences.reduce<Record<string, WeeklyAbsence[]>>((acc, absence) => {
    const list = acc[absence.user_id] ?? [];
    list.push({ start_date: absence.start_date, end_date: absence.end_date });
    acc[absence.user_id] = list;
    return acc;
  }, {});

  const now = new Date();

  const members = employeeIds.map<TeamMemberViewModel>((userId) => {
    const profile = profileMap.get(userId);
    const employeeSettings = settingsMap.get(userId);
    const hoursPerWeek = employeeSettings?.hours_per_week ?? 40;
    const lastMeetingDate = employeeSettings?.last_meeting_date ?? null;

    let nextMeetingDue: string | null = null;
    if (lastMeetingDate && employeeSettings?.meeting_interval_months) {
      const dueDate = new Date(lastMeetingDate);
      dueDate.setMonth(dueDate.getMonth() + employeeSettings.meeting_interval_months);
      nextMeetingDue = dueDate.toISOString();
    }

    const weeklyWorkedMinutes = weeklyMinutes[userId] ?? 0;
    const weeklyTarget = calculateWeeklyTarget({
      hoursPerWeek,
      daysPerWeek: employeeSettings?.days_per_week ?? null,
      workdays: employeeSettings?.workdays ?? null,
      weekStart,
      today,
      holidays,
      absences: absencesByUser[userId] ?? [],
    });
    const latestTimeEntryDate = lastGlobalEntry[userId] ?? null;
    const workStatus = buildTeamWorkStatus(weeklyWorkedMinutes, weeklyTarget, latestTimeEntryDate, now);
    const displayName = profile?.display_name?.trim() || "Unbekannt";

    return {
      userId,
      displayName,
      avatarUrl: profile?.avatar_url ?? null,
      badgeColor: profile?.badge_color ?? null,
      hoursPerWeek,
      daysPerWeek: weeklyTarget.workDaysPerWeek,
      workdays: weeklyTarget.workdays,
      lastMeetingDate,
      nextMeetingDue,
      openMeetingRequests: requestCounts[userId] ?? 0,
      weeklyWorkedMinutes,
      weeklyTargetMinutes: weeklyTarget.targetMinutes,
      weeklyAbsenceDays: weeklyTarget.absenceDays,
      lastTimeEntryDate: lastTimeEntryThisWeek[userId] ?? null,
      daysWithoutEntry: workStatus.daysWithoutEntry,
      initials: getInitials(displayName),
      workStatus: {
        ...workStatus,
        lastTimeEntryDate: lastTimeEntryThisWeek[userId] ?? latestTimeEntryDate,
      },
      meetingStatus: getMeetingStatus(nextMeetingDue),
    };
  });

  members.sort((left, right) => {
    if (left.openMeetingRequests > 0 && right.openMeetingRequests === 0) return -1;
    if (left.openMeetingRequests === 0 && right.openMeetingRequests > 0) return 1;
    if (left.nextMeetingDue && right.nextMeetingDue) {
      return new Date(left.nextMeetingDue).getTime() - new Date(right.nextMeetingDue).getTime();
    }
    if (left.nextMeetingDue) return -1;
    if (right.nextMeetingDue) return 1;
    return left.displayName.localeCompare(right.displayName, "de");
  });

  return members;
}

function buildOverview(teamMembers: TeamMemberViewModel[]): TeamOverviewMetrics {
  return {
    totalMembers: teamMembers.length,
    pendingMeetingRequests: teamMembers.reduce((sum, member) => sum + member.openMeetingRequests, 0),
    overdueMeetings: teamMembers.filter((member) => member.meetingStatus?.label === "Überfällig").length,
    membersWithoutRecentEntries: teamMembers.filter((member) => member.workStatus.needsAttention).length,
  };
}

async function fetchMyWorkTeamData(userId: string, tenantId: string): Promise<UseMyWorkTeamDataModel> {
  const userRole = await resolveViewerRole(userId, tenantId);
  const canViewTeam = getRoleFlags(userRole).canViewTeam;

  if (!canViewTeam) {
    return {
      canViewTeam,
      userRole,
      teamMembers: [],
      overview: EMPTY_OVERVIEW,
      issues: EMPTY_TEAM_DATA_ISSUES,
    };
  }

  const { employeeIds, membershipsFailed } = await resolveVisibleEmployeeIds(userId, tenantId);
  if (employeeIds.length === 0) {
    return {
      canViewTeam,
      userRole,
      teamMembers: [],
      overview: EMPTY_OVERVIEW,
      issues: { ...EMPTY_TEAM_DATA_ISSUES, memberships: membershipsFailed },
    };
  }

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [profilesResult, settingsResult, requestsResult, timeEntriesResult, latestEntriesResult, absencesResult, holidaysResult] =
    await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url, badge_color").in("user_id", employeeIds),
      supabase
        .from("employee_settings")
        .select("user_id, hours_per_week, days_per_week, workdays, last_meeting_date, meeting_interval_months")
        .in("user_id", employeeIds),
      supabase.from("employee_meeting_requests").select("employee_id").eq("status", "pending").in("employee_id", employeeIds),
      supabase
        .from("time_entries")
        .select("user_id, minutes, work_date")
        .in("user_id", employeeIds)
        .gte("work_date", weekStart)
        .lte("work_date", today),
      (supabase.rpc as unknown as <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>)(
        "get_latest_time_entry_dates",
        { p_user_ids: employeeIds },
      ),
      supabase
        .from("leave_requests")
        .select("user_id, start_date, end_date")
        .in("user_id", employeeIds)
        .in("type", [...WEEK_TARGET_ABSENCE_TYPES])
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", weekStart),
      supabase
        .from("public_holidays")
        .select("holiday_date, state, is_nationwide")
        .eq("tenant_id", tenantId)
        .gte("holiday_date", weekStart)
        .lte("holiday_date", today),
    ]);

  if (profilesResult.error) debugConsole.error("Error loading team profiles:", profilesResult.error);
  if (settingsResult.error) debugConsole.error("Error loading team settings:", settingsResult.error);
  if (requestsResult.error) debugConsole.error("Error loading team meeting requests:", requestsResult.error);
  if (timeEntriesResult.error) debugConsole.error("Error loading team time entries:", timeEntriesResult.error);
  if (latestEntriesResult.error) debugConsole.error("Error loading latest employee time entries:", latestEntriesResult.error);
  if (absencesResult.error) debugConsole.error("Error loading team absences:", absencesResult.error);
  if (holidaysResult.error) debugConsole.error("Error loading public holidays for team:", holidaysResult.error);

  const issues: TeamDataIssues = {
    memberships: membershipsFailed,
    profiles: Boolean(profilesResult.error),
    settings: Boolean(settingsResult.error),
    meetingRequests: Boolean(requestsResult.error),
    timeEntries: Boolean(timeEntriesResult.error),
    latestEntries: Boolean(latestEntriesResult.error),
    absences: Boolean(absencesResult.error),
    holidays: Boolean(holidaysResult.error),
  };

  const teamMembers = mapTeamMembers({
    employeeIds,
    profiles: (profilesResult.data as TeamProfileRow[] | null) ?? [],
    settings: (settingsResult.data as TeamSettingsRow[] | null) ?? [],
    requests: (requestsResult.data as TeamMeetingRequestRow[] | null) ?? [],
    weekEntries: (timeEntriesResult.data as TeamTimeEntryRow[] | null) ?? [],
    latestEntries: (latestEntriesResult.data as LatestTimeEntryRow[] | null) ?? [],
    absences: (absencesResult.data as TeamAbsenceRow[] | null) ?? [],
    holidays: (holidaysResult.data as PublicHolidayRow[] | null) ?? [],
    weekStart,
    today,
  });

  return {
    canViewTeam,
    userRole,
    teamMembers,
    overview: buildOverview(teamMembers),
    issues,
  };
}

export function useMyWorkTeamData(): UseMyWorkTeamDataResult {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const { role } = useResolvedUserRole();

  const queryKey = useMemo(() => ["my-work-team", currentTenant?.id, user?.id], [currentTenant?.id, user?.id]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchMyWorkTeamData(user!.id, currentTenant!.id),
    enabled: Boolean(user?.id && currentTenant?.id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const effectiveData = data ?? {
    canViewTeam: getRoleFlags(role).canViewTeam,
    userRole: role,
    teamMembers: [],
    overview: EMPTY_OVERVIEW,
    issues: EMPTY_TEAM_DATA_ISSUES,
  };

  useEffect(() => {
    if (!user?.id || !currentTenant?.id || !effectiveData.canViewTeam) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const channelName = `my-work-team-${user.id}-${crypto.randomUUID()}`;
    const scheduleReload = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        queryClient.invalidateQueries({ queryKey });
      }, 250);
    };

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_meeting_requests", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_settings" }, (payload) => {
        const changed = payload.new as { user_id?: string };
        const previous = payload.old as { user_id?: string };
        if (effectiveData.teamMembers.some(member => member.userId === (changed.user_id ?? previous.user_id))) scheduleReload();
      })
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, effectiveData.canViewTeam, effectiveData.teamMembers, queryClient, queryKey, user?.id]);

  const reload = useCallback(() => refetch(), [refetch]);

  return {
    data: effectiveData,
    ...effectiveData,
    isLoading,
    loading: isLoading,
    error: (error as Error | null) ?? null,
    refetch: reload,
    reload,
  };
}

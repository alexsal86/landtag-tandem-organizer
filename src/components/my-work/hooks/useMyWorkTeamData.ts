import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays, isWeekend, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useResolvedUserRole, type ResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { debugConsole } from "@/utils/debugConsole";

export type TeamViewerRole = NonNullable<ResolvedUserRole> | "";

interface TeamProfileRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface TeamSettingsRow {
  user_id: string;
  hours_per_week: number | null;
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

interface RawTeamMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  hoursPerWeek: number;
  lastMeetingDate: string | null;
  nextMeetingDue: string | null;
  openMeetingRequests: number;
  weeklyWorkedMinutes: number;
  weeklyTargetMinutes: number;
  lastTimeEntryDate: string | null;
  daysWithoutEntry: number;
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
  daysWithoutEntry: number;
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
}

export interface UseMyWorkTeamDataResult extends UseMyWorkTeamDataModel {
  data: UseMyWorkTeamDataModel;
  isLoading: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  reload: () => Promise<unknown>;
}

export const TEAM_TAB_ACCESS_RULES: TeamTabAccessRule[] = [
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

const TEAM_TAB_VISIBLE_ROLES = new Set<TeamViewerRole>(TEAM_TAB_ACCESS_RULES.map(({ role }) => role));
const TEAM_MEMBER_ROLES = new Set<TeamViewerRole>(["mitarbeiter", "praktikant", "bueroleitung"]);
const NO_TIME_ENTRY_BUSINESS_DAYS = 999;
const TIME_ENTRY_ATTENTION_THRESHOLD_DAYS = 3;
const EMPTY_OVERVIEW: TeamOverviewMetrics = {
  totalMembers: 0,
  pendingMeetingRequests: 0,
  overdueMeetings: 0,
  membersWithoutRecentEntries: 0,
};

export function calculateBusinessDaysSince(lastDate: string | null, today = new Date()): number {
  if (!lastDate) return NO_TIME_ENTRY_BUSINESS_DAYS;

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
    return "";
  }

  return ((data as { role?: TeamViewerRole } | null)?.role ?? "") as TeamViewerRole;
}

async function resolveVisibleEmployeeIds(userId: string, tenantId: string): Promise<string[]> {
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
    return Array.from(new Set(membershipIds));
  }

  const { data: managedEmployees, error: managedEmployeesError } = await supabase
    .from("employee_settings")
    .select("user_id")
    .eq("admin_id", userId);

  if (managedEmployeesError) {
    debugConsole.error("Error loading fallback managed employees:", managedEmployeesError);
  }

  return Array.from(new Set(((managedEmployees as { user_id: string }[] | null) ?? []).map((row) => row.user_id)));
}

function buildTeamWorkStatus(workedMinutes: number, targetMinutes: number, lastTimeEntryDate: string | null, today: Date): TeamWorkStatusViewModel {
  const indicator = getWorkIndicatorMeta(workedMinutes, targetMinutes);
  const daysWithoutEntry = calculateBusinessDaysSince(lastTimeEntryDate, today);

  return {
    workedHoursLabel: (workedMinutes / 60).toFixed(1).replace(".", ","),
    targetHoursLabel: (targetMinutes / 60).toFixed(0),
    indicatorVariant: indicator.variant,
    indicatorLabel: indicator.label,
    lastTimeEntryDate,
    daysWithoutEntry,
    needsAttention: daysWithoutEntry > TIME_ENTRY_ATTENTION_THRESHOLD_DAYS,
  };
}

function mapTeamMembers(
  employeeIds: string[],
  profiles: TeamProfileRow[],
  settings: TeamSettingsRow[],
  requests: TeamMeetingRequestRow[],
  weekEntries: TeamTimeEntryRow[],
  latestEntries: LatestTimeEntryRow[],
): TeamMemberViewModel[] {
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

  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  const workDaysPassed = Math.min(dayOfWeek, 5);

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
    const weeklyTargetMinutes = ((hoursPerWeek * 60) / 5) * workDaysPassed;
    const latestTimeEntryDate = lastGlobalEntry[userId] ?? null;
    const workStatus = buildTeamWorkStatus(weeklyWorkedMinutes, weeklyTargetMinutes, latestTimeEntryDate, today);
    const displayName = profile?.display_name?.trim() || "Unbekannt";

    return {
      userId,
      displayName,
      avatarUrl: profile?.avatar_url ?? null,
      hoursPerWeek,
      lastMeetingDate,
      nextMeetingDue,
      openMeetingRequests: requestCounts[userId] ?? 0,
      weeklyWorkedMinutes,
      weeklyTargetMinutes,
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
  const canViewTeam = TEAM_TAB_VISIBLE_ROLES.has(userRole);

  if (!canViewTeam) {
    return { canViewTeam, userRole, teamMembers: [], overview: EMPTY_OVERVIEW };
  }

  const employeeIds = await resolveVisibleEmployeeIds(userId, tenantId);
  if (employeeIds.length === 0) {
    return { canViewTeam, userRole, teamMembers: [], overview: EMPTY_OVERVIEW };
  }

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [profilesResult, settingsResult, requestsResult, timeEntriesResult, latestEntriesResult] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", employeeIds),
    supabase.from("employee_settings").select("user_id, hours_per_week, last_meeting_date, meeting_interval_months").in("user_id", employeeIds),
    supabase.from("employee_meeting_requests").select("employee_id").eq("status", "pending").in("employee_id", employeeIds),
    supabase.from("time_entries").select("user_id, minutes, work_date").in("user_id", employeeIds).gte("work_date", weekStart).lte("work_date", today),
    (supabase.rpc as <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>)("get_latest_time_entry_dates", { p_user_ids: employeeIds }),
  ]);

  if (profilesResult.error) debugConsole.error("Error loading team profiles:", profilesResult.error);
  if (settingsResult.error) debugConsole.error("Error loading team settings:", settingsResult.error);
  if (requestsResult.error) debugConsole.error("Error loading team meeting requests:", requestsResult.error);
  if (timeEntriesResult.error) debugConsole.error("Error loading team time entries:", timeEntriesResult.error);
  if (latestEntriesResult.error) debugConsole.error("Error loading latest employee time entries:", latestEntriesResult.error);

  const teamMembers = mapTeamMembers(
    employeeIds,
    (profilesResult.data as TeamProfileRow[] | null) ?? [],
    (settingsResult.data as TeamSettingsRow[] | null) ?? [],
    (requestsResult.data as TeamMeetingRequestRow[] | null) ?? [],
    (timeEntriesResult.data as TeamTimeEntryRow[] | null) ?? [],
    (latestEntriesResult.data as LatestTimeEntryRow[] | null) ?? [],
  );

  return {
    canViewTeam,
    userRole,
    teamMembers,
    overview: buildOverview(teamMembers),
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
    canViewTeam: TEAM_TAB_VISIBLE_ROLES.has((role ?? "") as TeamViewerRole),
    userRole: ((role ?? "") as TeamViewerRole),
    teamMembers: [],
    overview: EMPTY_OVERVIEW,
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
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, effectiveData.canViewTeam, queryClient, queryKey, user?.id]);

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

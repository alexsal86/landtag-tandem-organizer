export function employeeMeetingMetadata(description?: string | null): boolean {
  if (!description?.trimStart().startsWith("{")) return false;
  try {
    const metadata = JSON.parse(description);
    return typeof metadata?.employee_meeting_id === "string" && Boolean(metadata.employee_meeting_id.trim());
  } catch {
    return false;
  }
}

export function meetingAppointmentTitle(appointment: {
  title: string;
  category?: string | null;
  description?: string | null;
}): string {
  const title = appointment.title.trim();
  if (appointment.category !== "employee_meeting" && !employeeMeetingMetadata(appointment.description)) return appointment.title;
  if (/^Mitarbeitergespräch\b/i.test(title)) return title;
  return title ? `Mitarbeitergespräch mit ${title}` : "Mitarbeitergespräch";
}

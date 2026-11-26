import { supabase } from "@/integrations/supabase/client";

export interface AppointmentGuestRow {
  id: string;
  name: string;
  email: string;
  status: string;
  responded_at?: string | null;
  response_note?: string | null;
}

export interface AppointmentFeedbackRow {
  id: string;
  feedback_status: "pending" | "completed" | "skipped";
  notes: string | null;
  completed_at: string | null;
  has_documents: boolean;
  has_tasks: boolean;
}

export async function fetchAppointmentGuests(
  appointmentId: string,
): Promise<AppointmentGuestRow[]> {
  const { data, error } = await supabase
    .from("appointment_guests")
    .select("id, name, email, status, responded_at, response_note")
    .eq("appointment_id", appointmentId)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function fetchAppointmentFeedback(
  appointmentId: string,
): Promise<AppointmentFeedbackRow | null> {
  const { data, error } = await supabase
    .from("appointment_feedback")
    .select("id, feedback_status, notes, completed_at, has_documents, has_tasks")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    feedback_status: data.feedback_status as AppointmentFeedbackRow["feedback_status"],
    notes: data.notes,
    completed_at: data.completed_at,
    has_documents: data.has_documents || false,
    has_tasks: data.has_tasks || false,
  };
}

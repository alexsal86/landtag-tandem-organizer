import { ArrowRight, Calendar, FileCheck } from "lucide-react";
import { Link } from "react-router-dom";
import type { UpcomingAppointmentItem } from "./types";

import { appointmentHref, appointmentLabel } from "./sidebarAppointments";

export function FocusSummary({ approvalCount, nextAppointment, onNavigate }: {
  approvalCount: number;
  nextAppointment?: UpcomingAppointmentItem;
  onNavigate: () => void;
}) {
  if (!approvalCount && !nextAppointment) return null;
  return (
    <div className="mission-summary">
      {!!approvalCount && (
        <Link to="/mywork?tab=dashboard#unterschriftenmappe" onClick={onNavigate} className="mission-summary-link">
          <FileCheck aria-hidden="true" />
          <span>{approvalCount === 1 ? "1 Freigabe wartet" : `${approvalCount} Freigaben warten`}</span>
          <ArrowRight className="ml-auto" aria-hidden="true" />
        </Link>
      )}
      {nextAppointment && (
        <Link to={appointmentHref(nextAppointment)} onClick={onNavigate} className="mission-summary-link"
          title={nextAppointment.title}>
          <Calendar aria-hidden="true" />
          <span className="truncate"><span className="tabular-nums">{appointmentLabel(nextAppointment)}</span> · {nextAppointment.title}</span>
        </Link>
      )}
    </div>
  );
}

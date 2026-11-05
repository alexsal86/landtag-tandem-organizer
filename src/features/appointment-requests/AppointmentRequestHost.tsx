import { useEffect, useState } from "react";
import { AppointmentRequestCreateDialog } from "./AppointmentRequestCreateDialog";
import { AppointmentRequestDetailDialog } from "./AppointmentRequestDetailDialog";
import { onAppointmentRequestCreate, onAppointmentRequestDetail, openAppointmentRequestCreate, type RequestPrefill } from "./events";

/** Mounted once globally: listens for open-events and the keyboard shortcut. */
export function AppointmentRequestHost() {
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<RequestPrefill>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const offCreate = onAppointmentRequestCreate((p) => {
      setPrefill(p);
      setCreateOpen(true);
    });
    const offDetail = onAppointmentRequestDetail((id) => setDetailId(id));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "Period") {
        e.preventDefault();
        openAppointmentRequestCreate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offCreate();
      offDetail();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <AppointmentRequestCreateDialog open={createOpen} prefill={prefill} onOpenChange={setCreateOpen} />
      <AppointmentRequestDetailDialog requestId={detailId} onOpenChange={(o) => !o && setDetailId(null)} />
    </>
  );
}

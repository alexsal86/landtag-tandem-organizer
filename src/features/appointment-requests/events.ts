export interface RequestPrefill {
  title?: string;
  requester?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  location?: string;
  notes?: string;
}

const OPEN_CREATE = "appointment-request:create";
const OPEN_DETAIL = "appointment-request:detail";

export function openAppointmentRequestCreate(prefill: RequestPrefill = {}) {
  window.dispatchEvent(new CustomEvent<RequestPrefill>(OPEN_CREATE, { detail: prefill }));
}

export function openAppointmentRequestDetail(id: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_DETAIL, { detail: id }));
}

export function onAppointmentRequestCreate(handler: (prefill: RequestPrefill) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<RequestPrefill>).detail ?? {});
  window.addEventListener(OPEN_CREATE, listener);
  return () => window.removeEventListener(OPEN_CREATE, listener);
}

export function onAppointmentRequestDetail(handler: (id: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(OPEN_DETAIL, listener);
  return () => window.removeEventListener(OPEN_DETAIL, listener);
}

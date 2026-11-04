import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, ContactRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { ContactDetailSheet } from "@/features/contacts/components/ContactDetailSheet";

export function AppointmentContactCards({ appointmentId }: { appointmentId: string }) {
  const { currentTenant } = useTenant();
  const [dossierId, setDossierId] = useState<string | null>(null);
  const { data: contacts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["appointment-contact-cards", currentTenant?.id, appointmentId],
    enabled: !!currentTenant && !/^(external-|blocked-)/.test(appointmentId),
    queryFn: async () => {
      const [primary, linked] = await Promise.all([
        supabase.from("appointments").select("contact_id").eq("id", appointmentId).eq("tenant_id", currentTenant!.id).maybeSingle(),
        supabase.from("appointment_contacts").select("contact_id").eq("appointment_id", appointmentId),
      ]);
      if (primary.error) throw primary.error;
      if (linked.error) throw linked.error;
      const ids = [...new Set([primary.data?.contact_id, ...(linked.data ?? []).map(row => row.contact_id)].filter((id): id is string => !!id))];
      if (!ids.length) return [];
      const { data, error } = await supabase.from("contacts").select("id, name, position, organization, phone, business_phone, mobile_phone, email").in("id", ids).eq("tenant_id", currentTenant!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Kontakte werden geladen …</p>;
  if (isError) return <button className="text-sm underline" onClick={() => void refetch()}>Kontakte konnten nicht geladen werden. Erneut versuchen</button>;
  if (!contacts.length) return null;
  return <section className="space-y-3" aria-label="Verknüpfte Kontakte">
    <h3 className="font-medium">Verknüpfte Kontakte</h3>
    {contacts.map(contact => {
      const phone = contact.phone || contact.mobile_phone || contact.business_phone;
      return <div key={contact.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <p className="font-semibold">{contact.name}</p>
        <p className="text-sm text-muted-foreground">{[contact.position, contact.organization].filter(Boolean).join(" · ")}</p>
        <p className="text-sm break-all">{phone || "Keine Telefonnummer"}</p>
        <p className="text-sm break-all">{contact.email || "Keine E-Mail"}</p>
        <div className="flex flex-wrap gap-2">
          {phone && <Button asChild size="sm" variant="outline"><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone className="mr-1 h-3 w-3" />Anrufen</a></Button>}
          {contact.email && <Button asChild size="sm" variant="outline"><a href={`mailto:${contact.email}`}><Mail className="mr-1 h-3 w-3" />Mail schreiben</a></Button>}
          <Button size="sm" variant="outline" onClick={() => setDossierId(contact.id)}><ContactRound className="mr-1 h-3 w-3" />Kontaktdossier öffnen</Button>
        </div>
      </div>;
    })}
    {dossierId && <ContactDetailSheet contactId={dossierId} isOpen onContactUpdate={() => { void refetch(); }} onClose={() => setDossierId(null)} />}
  </section>;
}

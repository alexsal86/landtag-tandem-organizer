import { Calendar, Clock, MapPin, Users, Save, Plus, X, ChevronDown, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppointmentPollCreator } from "@/components/poll/AppointmentPollCreator";
import { AppointmentFileUpload } from "@/components/appointments/AppointmentFileUpload";
import { ContactSelector } from "@/features/contacts/components/ContactSelector";
import { GuestManager } from "@/features/appointments/components/GuestManager";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { TopicSelector } from "@/components/topics/TopicSelector";
import { useCreateAppointment } from "@/components/appointments/hooks/useCreateAppointment";
import { useTenantUsers } from "@/hooks/useTenantUsers";

const BRIEFING_OPTIONS = [["later", "Später klären"], ["none", "Kein Briefing"], ["compact", "Kurz-Briefing"], ["full", "Umfassend"]] as const;

function BriefingChoiceBlock({ hook }: { hook: ReturnType<typeof useCreateAppointment> }) {
  const { users } = useTenantUsers();
  const assigned = hook.briefingChoice === "compact" || hook.briefingChoice === "full";
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-label font-medium">Briefing</p>
      <div className="flex flex-wrap gap-1">
        {BRIEFING_OPTIONS.map(([v, l]) => (
          <Button key={v} type="button" size="sm" variant={hook.briefingChoice === v ? "default" : "outline"} onClick={() => hook.setBriefingChoice(v)}>{l}</Button>
        ))}
      </div>
      {assigned && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Select value={hook.briefingAssignee} onValueChange={hook.setBriefingAssignee}>
            <SelectTrigger><SelectValue placeholder="Wer übernimmt?" /></SelectTrigger>
            <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="datetime-local" value={hook.briefingDue} onChange={(e) => hook.setBriefingDue(e.target.value)} aria-label="Frist (Standard: Vortag 12 Uhr)" />
        </div>
      )}
      <p className="text-caption text-muted-foreground">Briefings vergeben können nur Abgeordnete und Büroleitung. Ohne Frist gilt der Vortag 12 Uhr.</p>
    </div>
  );
}

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateAppointmentDialog = ({ open, onOpenChange }: CreateAppointmentDialogProps) => {
  const hook = useCreateAppointment(open, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Neuen Termin erstellen</DialogTitle>
          <DialogDescription>Erstellen Sie einen neuen Terminkalendereintrag</DialogDescription>
        </DialogHeader>

        {hook.showPollCreator ? (
          <AppointmentPollCreator onClose={() => hook.setShowPollCreator(false)} />
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end"><Button variant="outline" onClick={() => hook.setShowPollCreator(true)} className="flex items-center gap-2"><Users className="h-4 w-4" />Terminabstimmung</Button></div>

            <Form {...(hook.form)}>
              <form onSubmit={hook.form.handleSubmit(hook.onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={hook.form.control} name="title" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Titel *</FormLabel><FormControl><Input placeholder="Titel des Termins" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={hook.form.control} name="description" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Beschreibung</FormLabel><FormControl><Textarea placeholder="Beschreibung des Termins" rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={hook.form.control} name="is_all_day" render={({ field }) => (<FormItem className="md:col-span-2 flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={(c) => hook.handleAllDayChange(c as boolean)} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Ganztägig</FormLabel><FormDescription>Termin als ganztägiges Ereignis markieren</FormDescription></div></FormItem>)} />
                  <FormField control={hook.form.control} name="start_date" render={({ field }) => (<FormItem><FormLabel>Startdatum *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  {!hook.isAllDay && <FormField control={hook.form.control} name="start_time" render={({ field }) => (<FormItem><FormLabel>Startzeit</FormLabel><FormControl><TimePickerCombobox value={field.value ?? ""} onChange={(v) => { field.onChange(v); hook.handleStartTimeChange(v); }} /></FormControl><FormMessage /></FormItem>)} />}
                  <FormField control={hook.form.control} name="end_date" render={({ field }) => (<FormItem><FormLabel>Enddatum</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  {!hook.isAllDay && <FormField control={hook.form.control} name="end_time" render={({ field }) => (<FormItem><FormLabel>Endzeit</FormLabel><FormControl><TimePickerCombobox value={field.value ?? ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />}
                  <FormField control={hook.form.control} name="location" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Ort</FormLabel><FormControl><Select value={field.value} onValueChange={(v) => { field.onChange(v); hook.handleLocationDetection(v); }}><SelectTrigger><SelectValue placeholder="Ort auswählen" /></SelectTrigger><SelectContent><SelectItem value="Digital">Digital</SelectItem>{hook.appointmentLocations.map(l => <SelectItem key={l.id} value={l.name}>{l.name}{l.address && <span className="text-muted-foreground ml-2">- {l.address}</span>}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={hook.form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Kategorie *</FormLabel><FormControl><Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger><SelectContent>{hook.appointmentCategories.map(c => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={hook.form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status *</FormLabel><FormControl><Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger><SelectContent>{hook.appointmentStatuses.map(s => <SelectItem key={s.name} value={s.name}>{s.label}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={hook.form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priorität</FormLabel><FormControl><Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(hook.priorityLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={hook.form.control} name="reminder_minutes" render={({ field }) => (<FormItem><FormLabel>Erinnerung (Minuten)</FormLabel><FormControl><Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Keine Erinnerung</SelectItem><SelectItem value="5">5 Minuten</SelectItem><SelectItem value="15">15 Minuten</SelectItem><SelectItem value="30">30 Minuten</SelectItem><SelectItem value="60">1 Stunde</SelectItem><SelectItem value="1440">1 Tag</SelectItem></SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
                </div>

                <BriefingChoiceBlock hook={hook} />

                <Collapsible open={hook.showAdvancedOptions} onOpenChange={hook.setShowAdvancedOptions}>
                  <CollapsibleTrigger asChild><Button variant="outline" className="w-full flex items-center gap-2"><ChevronDown className={`h-4 w-4 transition-transform ${hook.showAdvancedOptions ? 'rotate-180' : ''}`} />Erweiterte Optionen</Button></CollapsibleTrigger>
                  <CollapsibleContent className="space-y-6 mt-6">
                    <div className="space-y-4"><h3 className="text-lg font-medium">Teilnehmer</h3><ContactSelector onSelect={hook.addContact} />{hook.selectedContacts.length > 0 && <div className="space-y-2"><h4 className="font-medium">Ausgewählte Kontakte:</h4><div className="flex flex-wrap gap-2">{hook.selectedContacts.map(c => <Badge key={c.id} variant="secondary" className="gap-2">{c.first_name} {c.last_name}<X className="h-3 w-3 cursor-pointer" onClick={() => hook.removeContact(c.id)} /></Badge>)}</div></div>}</div>
                    <div className="space-y-4"><h3 className="text-lg font-medium">Externe Gäste</h3><GuestManager guests={hook.appointmentGuests} onGuestsChange={hook.setAppointmentGuests} /></div>
                    <div className="space-y-4"><h3 className="text-lg font-medium">Dateien</h3><AppointmentFileUpload onFilesChange={hook.setUploadedFiles} appointmentId={undefined} /></div>
                    <div className="space-y-4"><h3 className="text-lg font-medium flex items-center gap-2"><Tag className="h-4 w-4" />Themen</h3><TopicSelector selectedTopicIds={hook.selectedTopicIds} onTopicsChange={hook.setSelectedTopicIds} placeholder="Themen zuweisen..." /></div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                  <Button type="submit" disabled={hook.loading}>{hook.loading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Erstelle...</> : <><Save className="h-4 w-4 mr-2" />Termin erstellen</>}</Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

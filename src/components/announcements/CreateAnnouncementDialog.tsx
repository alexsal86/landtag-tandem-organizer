import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTeamAnnouncements, CreateAnnouncementData } from "@/hooks/useTeamAnnouncements";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(100, "Maximal 100 Zeichen"),
  message: z.string().min(1, "Nachricht ist erforderlich").max(2000, "Maximal 2000 Zeichen"),
  priority: z.enum(["critical", "warning", "info", "success"]),
  useSchedule: z.boolean(),
  starts_at: z.string().optional(),
  useExpiry: z.boolean(),
  expires_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const priorityOptions = [
  { value: "critical", label: "Kritisch", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-950/50", border: "border-red-500" },
  { value: "warning", label: "Warnung", icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950/50", border: "border-orange-500" },
  { value: "info", label: "Information", icon: Info, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950/50", border: "border-blue-500" },
  { value: "success", label: "Erfolg", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100 dark:bg-green-950/50", border: "border-green-500" },
];

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAnnouncementDialog({ open, onOpenChange }: CreateAnnouncementDialogProps) {
  const { createAnnouncement } = useTeamAnnouncements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      message: "",
      priority: "info",
      useSchedule: false,
      starts_at: "",
      useExpiry: false,
      expires_at: "",
    },
  });

  const priority = watch("priority");
  const useSchedule = watch("useSchedule");
  const useExpiry = watch("useExpiry");
  const title = watch("title");
  const message = watch("message");

  const selectedPriority = priorityOptions.find(p => p.value === priority)!;
  const Icon = selectedPriority.icon;

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    
    const announcementData: CreateAnnouncementData = {
      title: data.title,
      message: data.message,
      priority: data.priority,
      starts_at: data.useSchedule && data.starts_at ? new Date(data.starts_at).toISOString() : null,
      expires_at: data.useExpiry && data.expires_at ? new Date(data.expires_at).toISOString() : null,
    };

    const result = await createAnnouncement(announcementData);
    
    setIsSubmitting(false);
    
    if (result) {
      reset();
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Team-Mitteilung</DialogTitle>
          <DialogDescription>
            Erstellen Sie eine Mitteilung, die allen Teammitgliedern angezeigt wird.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              placeholder="Kurzer, aussagekräftiger Titel"
              {...register("title")}
              maxLength={100}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
            <p className="text-xs text-muted-foreground">{title.length}/100 Zeichen</p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Nachricht *</Label>
            <Textarea
              id="message"
              placeholder="Detaillierte Nachricht an das Team..."
              {...register("message")}
              rows={4}
              maxLength={2000}
            />
            {errors.message && (
              <p className="text-sm text-destructive">{errors.message.message}</p>
            )}
            <p className="text-xs text-muted-foreground">{message.length}/2000 Zeichen</p>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priorität</Label>
            <Select value={priority} onValueChange={(v) => setValue("priority", v as FormData["priority"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <OptionIcon className={cn("h-4 w-4", option.color)} />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Geplanter Start</Label>
                <p className="text-xs text-muted-foreground">Mitteilung erst ab einem bestimmten Zeitpunkt anzeigen</p>
              </div>
              <Switch
                checked={useSchedule}
                onCheckedChange={(checked) => setValue("useSchedule", checked)}
              />
            </div>
            {useSchedule && (
              <Input
                type="datetime-local"
                {...register("starts_at")}
              />
            )}
          </div>

          {/* Expiry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Ablaufdatum</Label>
                <p className="text-xs text-muted-foreground">Mitteilung automatisch ausblenden nach diesem Zeitpunkt</p>
              </div>
              <Switch
                checked={useExpiry}
                onCheckedChange={(checked) => setValue("useExpiry", checked)}
              />
            </div>
            {useExpiry && (
              <Input
                type="datetime-local"
                {...register("expires_at")}
              />
            )}
          </div>

          {/* Preview */}
          {(title || message) && (
            <div className="space-y-2">
              <Label>Vorschau</Label>
              <div className={cn(
                "border-l-4 p-4 rounded-r",
                selectedPriority.bg,
                selectedPriority.border
              )}>
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-5 w-5 mt-0.5", selectedPriority.color)} />
                  <div>
                    <h4 className="font-semibold">{title || "Titel der Mitteilung"}</h4>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{message || "Nachrichtentext..."}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Wird erstellt..." : "Mitteilung erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

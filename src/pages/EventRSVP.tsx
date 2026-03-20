import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Check, Clock3, MapPin, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import {
  fetchPublicInvitation,
  PublicInvitationApiError,
  respondToPublicInvitation,
  type InvitationStatus,
  type PublicInvitationData,
} from "@/services/publicInvitationApi";

type ResponseStatus = Exclude<InvitationStatus, "invited">;

const responseButtonConfig: Array<{
  status: ResponseStatus;
  label: string;
  mobileLabel: string;
  className?: string;
  variant?: "default" | "outline" | "destructive";
  icon: typeof Check;
}> = [
  {
    status: "accepted",
    label: "Zusagen",
    mobileLabel: "Zusage",
    className: "bg-green-600 text-white hover:bg-green-700",
    icon: Check,
  },
  {
    status: "tentative",
    label: "Unter Vorbehalt",
    mobileLabel: "Vorbehalt",
    variant: "outline",
    className: "border-amber-300 text-amber-700 hover:bg-amber-50",
    icon: Clock3,
  },
  {
    status: "declined",
    label: "Absagen",
    mobileLabel: "Absage",
    variant: "destructive",
    icon: X,
  },
];

const statusCopy: Record<InvitationStatus, { label: string; className?: string; variant?: "outline" | "destructive" }> = {
  invited: { label: "Noch offen", variant: "outline" },
  accepted: { label: "Zugesagt", className: "bg-green-500 text-white" },
  tentative: { label: "Unter Vorbehalt", className: "bg-amber-500 text-white" },
  declined: { label: "Abgesagt", variant: "destructive" },
};

function formatEventDate(date: string | null): string | null {
  if (!date) return null;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return format(parsed, "EEEE, dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de });
}

function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof PublicInvitationApiError) {
    switch (error.code) {
      case "invalid_code":
        return "Diese Einladung wurde nicht gefunden.";
      case "revoked_invitation":
        return "Diese Einladung wurde deaktiviert.";
      case "expired_invitation":
        return "Diese Einladung ist abgelaufen.";
      case "event_unavailable":
      case "invitation_unavailable":
        return "Diese Einladung ist aktuell nicht verfügbar.";
      case "comment_too_long":
        return "Der Kommentar ist zu lang. Bitte kürzen Sie ihn etwas.";
      default:
        return error.message;
    }
  }

  return "Die Einladung konnte nicht geladen werden.";
}

export default function EventRSVP() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invitation, setInvitation] = useState<PublicInvitationData | null>(null);
  const [comment, setComment] = useState("");
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!code) {
        setLoadError("Ungültiger Einladungslink.");
        setLoading(false);
        return;
      }

      try {
        setLoadError(null);
        const payload = await fetchPublicInvitation(code);
        setInvitation(payload);
        setComment(payload.comment ?? "");
        setConfirmationVisible(payload.rsvpStatus !== "invited");
      } catch (error) {
        debugConsole.error("Error loading public invitation", error);
        setLoadError(getFriendlyErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadInvitation();
  }, [code]);

  const formattedDate = useMemo(() => formatEventDate(invitation?.eventDate ?? null), [invitation?.eventDate]);

  const respond = async (status: ResponseStatus) => {
    if (!code || !invitation) return;

    setSaving(true);
    try {
      const response = await respondToPublicInvitation(code, status, comment);
      setInvitation({
        ...invitation,
        rsvpStatus: response.status,
        comment: response.comment,
        guestDisplayName: response.guestDisplayName ?? invitation.guestDisplayName,
        eventTitle: response.eventTitle ?? invitation.eventTitle,
      });
      setComment(response.comment ?? "");
      setConfirmationVisible(true);
      toast({
        title: "Antwort gespeichert",
        description:
          status === "accepted"
            ? "Vielen Dank, Ihre Zusage wurde gespeichert."
            : status === "declined"
              ? "Vielen Dank, Ihre Absage wurde gespeichert."
              : "Vielen Dank, Ihre Rückmeldung unter Vorbehalt wurde gespeichert.",
      });
    } catch (error) {
      debugConsole.error("Error saving public invitation response", error);
      toast({
        title: "Speichern fehlgeschlagen",
        description: getFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = invitation?.rsvpStatus ?? "invited";
  const badgeConfig = statusCopy[currentStatus];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-sm text-muted-foreground animate-pulse">Einladung wird geladen…</div>
      </div>
    );
  }

  if (!code || loadError || !invitation) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-lg">
          <Card className="border-destructive/20 shadow-sm">
            <CardContent className="p-6 text-center sm:p-8">
              <p className="text-base font-medium text-destructive">{loadError ?? "Ungültiger Einladungslink."}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Bitte verwenden Sie den vollständigen Link aus der Einladung oder wenden Sie sich an das Büro.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <Card className="overflow-hidden border-slate-200 shadow-lg shadow-slate-200/50">
          <CardHeader className="space-y-4 bg-white p-5 sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Veranstaltungseinladung</p>
                <CardTitle className="flex items-start gap-3 text-2xl leading-tight sm:text-3xl">
                  <CalendarIcon className="mt-1 h-6 w-6 shrink-0 text-primary" />
                  <span>{invitation.eventTitle ?? "Veranstaltung"}</span>
                </CardTitle>
              </div>
              <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                {badgeConfig.label}
              </Badge>
            </div>
            <CardDescription className="space-y-4 text-sm leading-6 text-slate-700 sm:text-base">
              {invitation.eventDescription && <p className="whitespace-pre-line">{invitation.eventDescription}</p>}
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                {formattedDate && (
                  <div className="flex items-start gap-3">
                    <CalendarIcon className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Datum</p>
                      <p className="font-medium text-slate-900">{formattedDate}</p>
                    </div>
                  </div>
                )}
                {invitation.eventLocation && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Ort</p>
                      <p className="font-medium text-slate-900">{invitation.eventLocation}</p>
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Eingeladene Person</p>
                  <p className="font-medium text-slate-900">{invitation.guestDisplayName ?? "Unbekannter Gast"}</p>
                </div>
              </div>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 p-5 sm:p-8">
            {confirmationVisible ? (
              <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Antwort bestätigt</h2>
                    <p className="text-sm text-slate-600">Ihre Rückmeldung wurde auf dieser Website gespeichert und kann bei Bedarf erneut geändert werden.</p>
                  </div>
                  <Badge variant={badgeConfig.variant} className={badgeConfig.className}>
                    {badgeConfig.label}
                  </Badge>
                </div>
                {comment.trim() && (
                  <div className="rounded-xl bg-white/80 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <MessageSquare className="h-4 w-4" /> Ihr Kommentar
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{comment}</p>
                  </div>
                )}
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmationVisible(false)}>
                  Antwort ändern
                </Button>
              </div>
            ) : null}

            {!confirmationVisible ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="comment" className="text-sm font-medium text-slate-900">Kommentar</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Optional: Hinweise zur Teilnahme, Begleitperson oder Anreise"
                    rows={4}
                    className="resize-none rounded-2xl border-slate-200 bg-white text-base shadow-sm"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {responseButtonConfig.map(({ status, label, mobileLabel, className, variant, icon: Icon }) => (
                    <Button
                      key={status}
                      onClick={() => void respond(status)}
                      disabled={saving}
                      variant={variant}
                      className={`min-h-12 rounded-2xl text-sm font-semibold sm:text-base ${className ?? ""}`.trim()}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span className="sm:hidden">{mobileLabel}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

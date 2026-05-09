import { useState, useEffect, useMemo, useCallback, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  PhoneCall,
  StickyNote,
  Copy,
  ChevronUp,
  ChevronDown,
  Maximize2,
  X,
  Edit2,
  ExternalLink,
  ArrowRight,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Linkedin, Facebook, Instagram, Twitter } from "@/components/icons/SocialIcons";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { getContactAvatarColor } from "@/components/contacts/utils/avatarColors";
import { ContactEditForm } from "@/features/contacts/components/ContactEditForm";
import { notify } from "@/lib/notify";

interface ContactRow {
  id: string;
  contact_type: "person" | "organization";
  name: string;
  role?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  birthday?: string | null;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  xing?: string | null;
  category?: string | null;
  priority?: "low" | "medium" | "high" | null;
  last_contact?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  business_street?: string | null;
  business_house_number?: string | null;
  business_postal_code?: string | null;
  business_city?: string | null;
  business_country?: string | null;
  updated_at?: string | null;
}

interface ActivityRow {
  id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  profiles?: { display_name?: string | null } | null;
}

interface CaseItemRow {
  id: string;
  subject: string | null;
  status: string;
}

interface RelationRow {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface ContactDetailSheetProps {
  contactId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdate: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  citizen: "Bürger:innen",
  colleague: "Kolleg:innen",
  business: "Wirtschaft",
  media: "Presse",
  lobbyist: "Lobbyist",
  organization: "Organisation",
  government: "Politik & Verw.",
  ngo: "NGO",
  academia: "Wissenschaft",
  healthcare: "Gesundheit",
  legal: "Recht",
  other: "Sonstige",
};

const ACTIVITY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  call: Phone,
  phone: Phone,
  email: Mail,
  mail: Mail,
  meeting: Calendar,
  appointment: Calendar,
  letter: FileText,
  brief: FileText,
  note: StickyNote,
  message: MessageSquare,
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function cleanSocialUsername(input: string): string {
  if (!input) return "";
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?/, "")
    .replace(/^(linkedin\.com\/in\/|x\.com\/|twitter\.com\/|facebook\.com\/|instagram\.com\/|xing\.com\/profile\/)/, "")
    .replace(/^@/, "")
    .replace(/\/$/, "")
    .trim();
}

function buildSocialUrl(platform: string, value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const u = cleanSocialUsername(value);
  switch (platform) {
    case "linkedin": return `https://www.linkedin.com/in/${u}`;
    case "twitter":  return `https://x.com/${u}`;
    case "facebook": return `https://www.facebook.com/${u}`;
    case "instagram":return `https://www.instagram.com/${u}`;
    case "xing":     return `https://www.xing.com/profile/${u}`;
    case "website":  return `https://${value.replace(/^https?:\/\//, "")}`;
    default:         return `https://${value}`;
  }
}

function formatRelative(dateIso: string): string {
  const d = new Date(dateIso).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} Mon.`;
  return new Date(dateIso).toLocaleDateString("de-DE");
}

function formatShortDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

function deriveFrequency(activityCount: number, lastContact?: string | null): { label: string; tone: string } {
  if (activityCount >= 6) return { label: "regelmäßig", tone: "bg-primary/10 text-primary border-primary/30" };
  if (activityCount >= 2) return { label: "gelegentlich", tone: "bg-muted text-muted-foreground border-border" };
  if (lastContact) return { label: "selten", tone: "bg-muted text-muted-foreground border-border" };
  return { label: "neu", tone: "bg-muted text-muted-foreground border-border" };
}

function deriveTone(activities: ActivityRow[]): string {
  for (const a of activities) {
    const text = `${a.title ?? ""} ${a.description ?? ""}`.toLowerCase();
    if (/(positiv|danke|gut|freundlich|👍|🙂)/.test(text)) return "positiv";
    if (/(negativ|kritisch|beschwerde|ärger|👎)/.test(text)) return "kritisch";
  }
  return "neutral";
}

const CASE_STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  waiting: "Wartet",
  on_hold: "Wartet",
  resolved: "Gelöst",
  closed: "Geschlossen",
  done: "Erledigt",
};

export function ContactDetailSheet({ contactId, isOpen, onClose, onContactUpdate }: ContactDetailSheetProps) {
  const navigate = useNavigate();
  const [contact, setContact] = useState<ContactRow | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [cases, setCases] = useState<CaseItemRow[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!contactId || !isOpen) return;
    setIsEditing(false);
    setTab("overview");
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [{ data: c, error: cErr }, { data: act }, { data: cs }] = await Promise.all([
          supabase
            .from("contacts")
            .select("id, contact_type, name, role, organization, organization_id, email, phone, address, birthday, website, linkedin, twitter, facebook, instagram, xing, category, priority, last_contact, avatar_url, notes, tags, business_street, business_house_number, business_postal_code, business_city, business_country, updated_at")
            .eq("id", contactId)
            .maybeSingle(),
          supabase
            .from("contact_activities")
            .select("id, activity_type, title, description, created_at, metadata, profiles:created_by(display_name)")
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("case_items")
            .select("id, subject, status")
            .eq("contact_id", contactId)
            .order("updated_at", { ascending: false })
            .limit(10),
        ]);
        if (cancelled) return;
        if (cErr) throw cErr;
        setContact((c as ContactRow) ?? null);
        setActivities((act ?? []) as unknown as ActivityRow[]);
        setCases((cs ?? []) as CaseItemRow[]);

        // Relations: persons sharing the same organization
        if (c?.contact_type === "organization") {
          const { data: rel } = await supabase
            .from("contacts")
            .select("id, name, avatar_url")
            .eq("organization_id", contactId)
            .eq("contact_type", "person")
            .limit(8);
          if (!cancelled) setRelations((rel ?? []) as RelationRow[]);
        } else if (c?.organization_id) {
          const { data: rel } = await supabase
            .from("contacts")
            .select("id, name, avatar_url")
            .eq("organization_id", c.organization_id)
            .eq("contact_type", "person")
            .neq("id", contactId)
            .limit(8);
          if (!cancelled) setRelations((rel ?? []) as RelationRow[]);
        } else {
          if (!cancelled) setRelations([]);
        }
      } catch (e) {
        debugConsole.error("ContactDetailSheet load error", e);
        notify.error("Fehler", { description: "Kontakt konnte nicht geladen werden."
});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contactId, isOpen, toast]);

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify.success("Kopiert", { description: `${label} wurde in die Zwischenablage kopiert.` 
});
    } catch {
      notify.error("Fehler", { description: "Kopieren nicht möglich."
});
    }
  }, [toast]);

  const formattedAddress = useMemo(() => {
    if (!contact) return null;
    const street = [contact.business_street, contact.business_house_number].filter(Boolean).join(" ");
    const city = [contact.business_postal_code, contact.business_city].filter(Boolean).join(" ");
    const full = [street, city].filter(Boolean).join(", ");
    return full || contact.address || null;
  }, [contact]);

  const socialChips = useMemo(() => {
    if (!contact) return [];
    return [
      contact.website && { key: "website", icon: Globe, label: "Website", href: buildSocialUrl("website", contact.website) },
      contact.linkedin && { key: "linkedin", icon: Linkedin, label: "LinkedIn", href: buildSocialUrl("linkedin", contact.linkedin) },
      contact.twitter && { key: "twitter", icon: Twitter, label: "X / Twitter", href: buildSocialUrl("twitter", contact.twitter) },
      contact.facebook && { key: "facebook", icon: Facebook, label: "Facebook", href: buildSocialUrl("facebook", contact.facebook) },
      contact.instagram && { key: "instagram", icon: Instagram, label: "Instagram", href: buildSocialUrl("instagram", contact.instagram) },
      contact.xing && { key: "xing", icon: Globe, label: "Xing", href: buildSocialUrl("xing", contact.xing) },
    ].filter(Boolean) as Array<{ key: string; icon: ComponentType<{ className?: string }>; label: string; href: string }>;
  }, [contact]);

  const frequency = useMemo(() => deriveFrequency(activities.length, contact?.last_contact), [activities.length, contact?.last_contact]);
  const tone = useMemo(() => deriveTone(activities), [activities]);
  const lastInteraction = activities[0];
  const categoryLabel = contact?.category ? (CATEGORY_LABELS[contact.category] ?? contact.category) : null;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="p-0 w-full sm:max-w-[600px] sm:w-[600px] overflow-hidden flex flex-col gap-0"
      >
        {loading || !contact ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isEditing ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <button
                onClick={() => setIsEditing(false)}
                className="text-caption text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Zurück
              </button>
              <span className="text-caption text-muted-foreground">Kontakt bearbeiten</span>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="Schließen">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ContactEditForm
                contact={contact as unknown as Parameters<typeof ContactEditForm>[0]["contact"]}
                onSuccess={() => { setIsEditing(false); onContactUpdate(); }}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Topbar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-muted/20">
              <div className="text-caption text-muted-foreground truncate">
                {categoryLabel}
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Vorheriger" disabled>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Nächster" disabled>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Vollbild"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Schließen" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Identity */}
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={contact.avatar_url ?? undefined} />
                  <AvatarFallback className={`${getContactAvatarColor(contact.id || contact.name)} font-semibold`}>
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-h2 leading-tight">{contact.name}</h2>
                  {contact.role && (
                    <div className="text-body text-muted-foreground truncate">{contact.role}</div>
                  )}
                  {contact.organization && (
                    <div className="text-body text-muted-foreground truncate">{contact.organization}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={frequency.tone}>
                      {frequency.label}
                    </Badge>
                    <span className="text-caption text-muted-foreground">·</span>
                    <span className="text-caption text-muted-foreground">Ton: {tone}</span>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!contact.phone}
                  asChild={!!contact.phone}
                >
                  {contact.phone ? <a href={`tel:${contact.phone}`}><Phone className="h-4 w-4" /> Anrufen</a> : <span><Phone className="h-4 w-4" /> Anrufen</span>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!contact.email}
                  asChild={!!contact.email}
                >
                  {contact.email ? <a href={`mailto:${contact.email}`}><Mail className="h-4 w-4" /> Mail</a> : <span><Mail className="h-4 w-4" /> Mail</span>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate(`/calendar?contactId=${contact.id}`)}
                >
                  <Calendar className="h-4 w-4" /> Termin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate(`/contacts/${contact.id}?action=note`)}
                >
                  <StickyNote className="h-4 w-4" /> Notiz
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0 px-5 gap-6 shrink-0">
                {[
                  { v: "overview", label: "Übersicht" },
                  { v: "chronology", label: "Chronologie" },
                  { v: "cases", label: "Vorgänge" },
                  { v: "notes", label: "Notizen" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-body font-medium"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="overview" className="m-0 p-5 space-y-5">
                  {/* Contact data */}
                  <section>
                    <div className="section-label mb-2">Kontaktdaten</div>
                    <div className="space-y-1.5">
                      {contact.email && (
                        <ContactDataRow icon={Mail} value={contact.email} onCopy={() => handleCopy(contact.email!, "E-Mail")} />
                      )}
                      {contact.phone && (
                        <ContactDataRow icon={Phone} value={contact.phone} onCopy={() => handleCopy(contact.phone!, "Telefon")} />
                      )}
                      {formattedAddress && (
                        <ContactDataRow icon={MapPin} value={formattedAddress} onCopy={() => handleCopy(formattedAddress, "Adresse")} />
                      )}
                    </div>

                    {socialChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {socialChips.map((chip) => {
                          const Icon = chip.icon;
                          return (
                            <a
                              key={chip.key}
                              href={chip.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border bg-background hover:bg-muted text-caption text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={chip.label}
                              title={chip.label}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {chip.label}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Last interaction */}
                  {lastInteraction && (
                    <section className="rounded-md border border-primary/30 bg-primary/5 p-3.5">
                      <div className="text-caption font-medium text-primary mb-1.5">LETZTE INTERAKTION</div>
                      <div className="text-body font-medium text-foreground">
                        {formatActivityType(lastInteraction.activity_type)} · {lastInteraction.title ?? "—"}
                      </div>
                      <div className="text-caption text-muted-foreground mt-0.5">
                        {formatRelative(lastInteraction.created_at)}
                        {lastInteraction.profiles?.display_name && ` · ${lastInteraction.profiles.display_name}`}
                      </div>
                    </section>
                  )}

                  {/* Activity */}
                  {activities.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <div className="section-label">Aktivität</div>
                        <button
                          onClick={() => setTab("chronology")}
                          className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          Alle {activities.length} anzeigen <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                      <ul className="space-y-2.5">
                        {activities.slice(0, 3).map((a) => {
                          const Icon = ACTIVITY_ICONS[a.activity_type] ?? StickyNote;
                          return (
                            <li key={a.id} className="flex gap-2.5">
                              <div className="flex flex-col items-center pt-1">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-caption text-muted-foreground tabular-nums">
                                  {formatShortDate(a.created_at)}
                                </div>
                                <div className="text-body font-medium text-foreground">
                                  {formatActivityType(a.activity_type)}{a.title ? ` · ${a.title}` : ""}
                                </div>
                                {a.description && (
                                  <div className="text-caption text-muted-foreground line-clamp-2">{a.description}</div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {/* Linked cases */}
                  {cases.length > 0 && (
                    <section>
                      <div className="section-label mb-2">Verknüpfte Vorgänge · {cases.length}</div>
                      <ul className="space-y-1.5">
                        {cases.map((c) => (
                          <li key={c.id}>
                            <button
                              onClick={() => navigate(`/cases/${c.id}`)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border hover:bg-muted text-left transition-colors"
                            >
                              <span className="flex-1 truncate text-body">{c.subject ?? "Ohne Titel"}</span>
                              <Badge variant="outline" className="text-caption shrink-0">
                                {CASE_STATUS_LABELS[c.status] ?? c.status}
                              </Badge>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Tags + relations */}
                  {((contact.tags?.length ?? 0) > 0 || relations.length > 0) && (
                    <section className="grid grid-cols-2 gap-5">
                      {contact.tags && contact.tags.length > 0 && (
                        <div>
                          <div className="section-label mb-2">Tags</div>
                          <div className="flex flex-wrap gap-1.5">
                            {contact.tags.map((t) => (
                              <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {relations.length > 0 && (
                        <div>
                          <div className="section-label mb-2">Beziehungen · {relations.length}</div>
                          <div className="flex -space-x-2">
                            {relations.slice(0, 6).map((r) => (
                              <button
                                key={r.id}
                                onClick={() => navigate(`/contacts/${r.id}`)}
                                title={r.name}
                                className="ring-2 ring-background rounded-full"
                              >
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={r.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-caption bg-muted">{getInitials(r.name)}</AvatarFallback>
                                </Avatar>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </TabsContent>

                <TabsContent value="chronology" className="m-0 p-5">
                  {activities.length === 0 ? (
                    <p className="text-body text-muted-foreground">Noch keine Aktivitäten erfasst.</p>
                  ) : (
                    <ul className="space-y-3">
                      {activities.map((a) => {
                        const Icon = ACTIVITY_ICONS[a.activity_type] ?? StickyNote;
                        return (
                          <li key={a.id} className="flex gap-3 border-b border-border pb-3 last:border-0">
                            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-caption text-muted-foreground">
                                {new Date(a.created_at).toLocaleString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                {a.profiles?.display_name && ` · ${a.profiles.display_name}`}
                              </div>
                              <div className="text-body font-medium">{formatActivityType(a.activity_type)}{a.title ? ` · ${a.title}` : ""}</div>
                              {a.description && <p className="text-body text-muted-foreground whitespace-pre-wrap">{a.description}</p>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="cases" className="m-0 p-5">
                  {cases.length === 0 ? (
                    <p className="text-body text-muted-foreground">Keine verknüpften Vorgänge.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {cases.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => navigate(`/cases/${c.id}`)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md border border-border hover:bg-muted text-left transition-colors"
                          >
                            <span className="flex-1 truncate text-body">{c.subject ?? "Ohne Titel"}</span>
                            <Badge variant="outline" className="text-caption shrink-0">
                              {CASE_STATUS_LABELS[c.status] ?? c.status}
                            </Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="m-0 p-5">
                  {contact.notes ? (
                    <div className="rounded-md border border-border p-3.5 bg-muted/20">
                      <p className="text-body text-foreground whitespace-pre-wrap">{contact.notes}</p>
                    </div>
                  ) : (
                    <p className="text-body text-muted-foreground">Keine Notizen vorhanden.</p>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10 shrink-0">
              <span className="text-caption text-muted-foreground">
                {contact.updated_at ? `Aktualisiert: ${new Date(contact.updated_at).toLocaleDateString("de-DE")}` : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
                  <Edit2 className="h-3.5 w-3.5" /> Bearbeiten
                </Button>
                <Button size="sm" onClick={() => navigate(`/contacts/${contact.id}`)} className="gap-1.5">
                  Auf Seite öffnen <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatActivityType(type: string): string {
  switch (type) {
    case "call":
    case "phone": return "Anruf";
    case "email":
    case "mail": return "E-Mail";
    case "meeting":
    case "appointment": return "Termin";
    case "letter":
    case "brief": return "Brief";
    case "note": return "Notiz";
    case "message": return "Nachricht";
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

interface ContactDataRowProps {
  icon: ComponentType<{ className?: string }>;
  value: string;
  onCopy: () => void;
}

function ContactDataRow({ icon: Icon, value, onCopy }: ContactDataRowProps) {
  return (
    <div className="group flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="flex-1 truncate text-body text-foreground">{value}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="h-7 px-2 text-caption opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Copy className="h-3 w-3 mr-1" /> Kopieren
      </Button>
    </div>
  );
}

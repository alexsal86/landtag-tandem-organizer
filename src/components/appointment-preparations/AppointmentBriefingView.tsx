import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AppointmentPreparation,
  getBriefingNotes,
  getConversationPartnersFromPreparationData,
  getImportantTopicLines,
  splitPreparationTextToList,
} from "@/hooks/useAppointmentPreparation";
import {
  UsersIcon,
  MessageCircleIcon,
  CheckSquareIcon,
  CompassIcon,
  ClockIcon,
  MegaphoneIcon,
} from "lucide-react";

const VISIT_REASON_LABELS: Record<string, string> = {
  einladung: "Einladung der Person/Einrichtung",
  eigeninitiative: "Eigeninitiative",
  fraktionsarbeit: "Fraktionsarbeit",
  pressetermin: "Pressetermin",
};

interface AppointmentBriefingViewProps {
  preparation: AppointmentPreparation;
  appointmentInfo?: {
    title: string;
    start_time: string;
    end_time: string;
    location?: string | null;
  } | null;
}

interface BriefingSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}

function BriefingSection({ icon, title, children, isEmpty }: BriefingSectionProps) {
  if (isEmpty) return null;
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        {title}
      </div>
      <div className="pl-6 space-y-1 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <p key={i} className="flex gap-2">
          <span className="text-primary shrink-0">→</span>
          <span className="break-words">{item}</span>
        </p>
      ))}
    </>
  );
}

function getPublicRelationsBadges(preparationData: AppointmentPreparation["preparation_data"]) {
  return [
    preparationData.social_media_planned ? "Social Media geplant" : null,
    preparationData.press_planned ? "Presse geplant" : null,
  ].filter(Boolean) as string[];
}

function ConversationPartnerList({
  partners,
}: {
  partners: ReturnType<typeof getConversationPartnersFromPreparationData>;
}) {
  return (
    <div className="space-y-3">
      {partners.map((partner) => {
        const secondaryParts = [partner.role, partner.organization, partner.note].filter(Boolean);
        const initials = partner.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("") || "?";

        return (
          <div key={partner.id} className="flex items-start gap-3">
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={partner.avatar_url || undefined} alt={partner.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1 pt-0.5">
              <p className="font-medium text-foreground break-words">{partner.name}</p>
              {secondaryParts.length > 0 && (
                <p className="text-muted-foreground break-words">
                  {secondaryParts.join(" • ")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function AppointmentBriefingView({ preparation, appointmentInfo }: AppointmentBriefingViewProps) {
  const d = preparation.preparation_data;
  const incompleteTodos = preparation.checklist_items?.filter((item) => !item.completed) ?? [];
  const conversationPartners = getConversationPartnersFromPreparationData(d);
  const companions = d.companions ?? [];
  const program = d.program ?? [];

  const peopleContextLines = [d.audience, d.facts_figures].filter(Boolean) as string[];
  const importantTopicLines = getImportantTopicLines(d);
  const additionalContextLines = [
    ...splitPreparationTextToList(d.position_statements),
    ...splitPreparationTextToList(d.objectives),
    ...splitPreparationTextToList(d.questions_answers),
  ];
  const briefingNotes = getBriefingNotes(preparation);
  const publicRelationsBadges = getPublicRelationsBadges(d);
  const visitReasonLabel = d.visit_reason ? VISIT_REASON_LABELS[d.visit_reason] ?? d.visit_reason : "";
  const visitReasonDetails = d.visit_reason_details?.trim();
  const visitReasonLines = [visitReasonLabel, visitReasonDetails].filter(Boolean) as string[];

  const hasContent =
    conversationPartners.length > 0 ||
    peopleContextLines.length > 0 ||
    importantTopicLines.length > 0 ||
    additionalContextLines.length > 0 ||
    Boolean(briefingNotes) ||
    incompleteTodos.length > 0 ||
    companions.length > 0 ||
    program.length > 0;

  return (
    <Card className="bg-card border-border shadow-card overflow-hidden">
      <div className="bg-primary/5 border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">BRIEFING</h2>
            {appointmentInfo && (
              <p className="mt-1 text-sm text-muted-foreground">
                {appointmentInfo.title}
                {appointmentInfo.location && ` · ${appointmentInfo.location}`}
              </p>
            )}
          </div>

          {publicRelationsBadges.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 lg:max-w-xs">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MegaphoneIcon className="h-3.5 w-3.5" />
                Öffentlichkeitsarbeit
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {publicRelationsBadges.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <CardContent className="py-6">
        {!hasContent ? (
          <p className="text-center text-muted-foreground py-8">
            Noch keine Vorbereitungsdaten vorhanden. Mitarbeiter können die Vorbereitung befüllen.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="space-y-6">
              <BriefingSection
                icon={<UsersIcon className="h-4 w-4" />}
                title="Gesprächspartner"
                isEmpty={conversationPartners.length === 0}
              >
                <ConversationPartnerList partners={conversationPartners} />
              </BriefingSection>

              <BriefingSection
                icon={<UsersIcon className="h-4 w-4" />}
                title="Begleitpersonen"
                isEmpty={companions.length === 0}
              >
                <div className="space-y-2 pt-1">
                  {companions.map((companion) => (
                    <div key={companion.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm">
                      <p className="font-medium">{companion.name}</p>
                      <p className="text-muted-foreground">
                        {[companion.type, companion.note].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  ))}
                </div>
              </BriefingSection>

              <BriefingSection
                icon={<UsersIcon className="h-4 w-4" />}
                title="Zusätzlicher Kontext"
                isEmpty={peopleContextLines.length === 0}
              >
                <BulletList items={peopleContextLines} />
              </BriefingSection>

              <BriefingSection
                icon={<MessageCircleIcon className="h-4 w-4" />}
                title="Wichtige Themen"
                isEmpty={importantTopicLines.length === 0}
              >
                <BulletList items={importantTopicLines} />
              </BriefingSection>

              <BriefingSection
                icon={<MessageCircleIcon className="h-4 w-4" />}
                title="Zusätzliche Gesprächsgrundlage"
                isEmpty={additionalContextLines.length === 0}
              >
                <BulletList items={additionalContextLines} />
              </BriefingSection>

              <BriefingSection
                icon={<CheckSquareIcon className="h-4 w-4" />}
                title="Weitere Notizen"
                isEmpty={!briefingNotes}
              >
                <p className="whitespace-pre-wrap break-words">{briefingNotes}</p>
              </BriefingSection>

              <BriefingSection
                icon={<CheckSquareIcon className="h-4 w-4" />}
                title="Offene To-dos"
                isEmpty={incompleteTodos.length === 0}
              >
                <div className="space-y-1.5">
                  {incompleteTodos.map((item) => (
                    <p key={item.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground shrink-0">☐</span>
                      <span className="break-words">{item.label}</span>
                    </p>
                  ))}
                </div>
              </BriefingSection>
            </div>

            <div className="space-y-6">
              <BriefingSection
                icon={<CompassIcon className="h-4 w-4" />}
                title="Anlass des Besuchs"
                isEmpty={visitReasonLines.length === 0}
              >
                <div className="space-y-2">
                  {visitReasonLabel && (
                    <p className="break-words font-medium text-foreground">{visitReasonLabel}</p>
                  )}
                  {visitReasonDetails && (
                    <p className="break-words whitespace-pre-wrap text-muted-foreground">{visitReasonDetails}</p>
                  )}
                </div>
              </BriefingSection>

              <BriefingSection
                icon={<ClockIcon className="h-4 w-4" />}
                title="Ablauf"
                isEmpty={program.length === 0}
              >
                <div className="space-y-2">
                  {program.map((programItem) => (
                    <div key={programItem.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3">
                      <span className="pt-0.5 text-primary shrink-0 font-mono text-xs">
                        {programItem.time}
                      </span>
                      <div className="space-y-1">
                        <p className="break-words">{programItem.item}</p>
                        {programItem.notes && (
                          <p className="break-words text-xs text-muted-foreground">{programItem.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </BriefingSection>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

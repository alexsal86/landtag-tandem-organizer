import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import {
  UsersIcon,
  MessageCircleIcon,
  CheckSquareIcon,
  CompassIcon,
  ClockIcon,
} from "lucide-react";

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

function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function AppointmentBriefingView({ preparation, appointmentInfo }: AppointmentBriefingViewProps) {
  const d = preparation.preparation_data;
  const incompleteTodos = preparation.checklist_items?.filter((item) => !item.completed) ?? [];
  const companions = d.companions ?? [];
  const program = d.program ?? [];

  const contactLines = [d.audience, d.facts_figures].filter(Boolean) as string[];
  const keyTopicLines = [
    ...splitLines(d.position_statements),
    ...splitLines(d.objectives),
    ...splitLines(d.questions_answers),
    ...splitLines(d.key_topics),
  ];

  const hasContent =
    contactLines.length > 0 ||
    keyTopicLines.length > 0 ||
    incompleteTodos.length > 0 ||
    companions.length > 0 ||
    program.length > 0;

  return (
    <Card className="bg-card border-border shadow-card overflow-hidden">
      <div className="bg-primary/5 border-b border-border px-6 py-5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">BRIEFING</h2>
        {appointmentInfo && (
          <p className="text-sm text-muted-foreground mt-1">
            {appointmentInfo.title}
            {appointmentInfo.location && ` · ${appointmentInfo.location}`}
          </p>
        )}
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
                isEmpty={contactLines.length === 0 && companions.length === 0}
              >
                {contactLines.length > 0 && <BulletList items={contactLines} />}
                {companions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {companions.map((companion) => (
                      <Badge key={companion.id} variant="secondary" className="text-xs">
                        {companion.name}
                        {companion.note && (
                          <span className="text-muted-foreground ml-1">({companion.note})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}
              </BriefingSection>

              <BriefingSection
                icon={<MessageCircleIcon className="h-4 w-4" />}
                title="Wichtige Themen"
                isEmpty={keyTopicLines.length === 0}
              >
                <BulletList items={keyTopicLines} />
              </BriefingSection>

              <BriefingSection
                icon={<CheckSquareIcon className="h-4 w-4" />}
                title="Weitere Notizen"
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
                isEmpty={!preparation.title?.trim()}
              >
                <p className="break-words font-medium text-foreground">{preparation.title}</p>
              </BriefingSection>

              <BriefingSection
                icon={<ClockIcon className="h-4 w-4" />}
                title="Ablauf"
                isEmpty={program.length === 0}
              >
                <div className="space-y-1">
                  {program.map((programItem) => (
                    <p key={programItem.id} className="flex gap-2">
                      <span className="text-primary shrink-0 font-mono text-xs min-w-[3rem]">
                        {programItem.time}
                      </span>
                      <span className="break-words">{programItem.item}</span>
                    </p>
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

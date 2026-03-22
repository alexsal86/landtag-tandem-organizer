import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import {
  Building2Icon, CompassIcon, TargetIcon, AlertTriangleIcon,
  MessageCircleIcon, CheckSquareIcon, UsersIcon, ClockIcon
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
    <div className="space-y-2">
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
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

export function AppointmentBriefingView({ preparation, appointmentInfo }: AppointmentBriefingViewProps) {
  const d = preparation.preparation_data;
  const incompleteTodos = preparation.checklist_items?.filter(i => !i.completed) ?? [];
  const companions = d.companions ?? [];
  const program = d.program ?? [];

  const backgroundLines = [d.audience, d.facts_figures].filter(Boolean) as string[];
  const positionLines = splitLines(d.position_statements);
  const objectiveLines = splitLines(d.objectives);
  const questionLines = splitLines(d.questions_answers);
  const keyMessage = d.key_topics?.trim();

  const hasContent = backgroundLines.length > 0 || positionLines.length > 0 ||
    objectiveLines.length > 0 || questionLines.length > 0 || keyMessage ||
    incompleteTodos.length > 0 || companions.length > 0 || program.length > 0;

  return (
    <Card className="bg-card border-border shadow-card overflow-hidden">
      {/* Header */}
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
          <div className="space-y-6">
            {/* Organisation / Hintergrund */}
            <BriefingSection
              icon={<Building2Icon className="h-4 w-4" />}
              title="Organisation / Hintergrund"
              isEmpty={backgroundLines.length === 0}
            >
              <BulletList items={backgroundLines} />
            </BriefingSection>

            {backgroundLines.length > 0 && (positionLines.length > 0 || objectiveLines.length > 0) && (
              <Separator className="bg-border/50" />
            )}

            {/* Meine Position / Linie */}
            <BriefingSection
              icon={<CompassIcon className="h-4 w-4" />}
              title="Meine Position / Linie"
              isEmpty={positionLines.length === 0}
            >
              <BulletList items={positionLines} />
            </BriefingSection>

            {/* Was will ich erreichen? */}
            <BriefingSection
              icon={<TargetIcon className="h-4 w-4" />}
              title="Was will ich erreichen?"
              isEmpty={objectiveLines.length === 0}
            >
              <BulletList items={objectiveLines} />
            </BriefingSection>

            {(positionLines.length > 0 || objectiveLines.length > 0) && questionLines.length > 0 && (
              <Separator className="bg-border/50" />
            )}

            {/* Mögliche kritische Fragen */}
            <BriefingSection
              icon={<AlertTriangleIcon className="h-4 w-4" />}
              title="Mögliche kritische Fragen"
              isEmpty={questionLines.length === 0}
            >
              <BulletList items={questionLines} />
            </BriefingSection>

            {/* Kernbotschaft */}
            {keyMessage && (
              <>
                <Separator className="bg-border/50" />
                <BriefingSection
                  icon={<MessageCircleIcon className="h-4 w-4" />}
                  title="Kernbotschaft"
                >
                  <p className="italic text-foreground font-medium border-l-2 border-primary pl-3">
                    „{keyMessage}"
                  </p>
                </BriefingSection>
              </>
            )}

            {/* Begleitpersonen */}
            {companions.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <BriefingSection
                  icon={<UsersIcon className="h-4 w-4" />}
                  title="Begleitpersonen"
                >
                  <div className="flex flex-wrap gap-2">
                    {companions.map(c => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.name}
                        {c.note && <span className="text-muted-foreground ml-1">({c.note})</span>}
                      </Badge>
                    ))}
                  </div>
                </BriefingSection>
              </>
            )}

            {/* Ablauf */}
            {program.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <BriefingSection
                  icon={<ClockIcon className="h-4 w-4" />}
                  title="Ablauf"
                >
                  <div className="space-y-1">
                    {program.map(p => (
                      <p key={p.id} className="flex gap-2">
                        <span className="text-primary shrink-0 font-mono text-xs min-w-[3rem]">{p.time}</span>
                        <span>{p.item}</span>
                      </p>
                    ))}
                  </div>
                </BriefingSection>
              </>
            )}

            {/* ToDos vor Termin */}
            {incompleteTodos.length > 0 && (
              <>
                <Separator className="bg-border/50" />
                <BriefingSection
                  icon={<CheckSquareIcon className="h-4 w-4" />}
                  title="ToDos vor Termin"
                >
                  <div className="space-y-1.5">
                    {incompleteTodos.map(item => (
                      <p key={item.id} className="flex items-start gap-2">
                        <span className="text-muted-foreground shrink-0">☐</span>
                        <span className="break-words">{item.label}</span>
                      </p>
                    ))}
                  </div>
                </BriefingSection>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { FunFactsEditor } from './FunFactsEditor';
import { TwoTruthsWidget } from './TwoTruthsWidget';
import { QuestionBank } from './QuestionBank';
import { WeeklyQuestionWidget } from './WeeklyQuestionWidget';
import { TeamEvents } from './TeamEvents';
export function TeamRitualWorkspace() {
  return <section className="space-y-5" aria-label="Team-Rituale">
    <h2 className="text-xl font-semibold">Team-Rituale</h2>
    <p className="text-sm text-muted-foreground">Fragen, persönliche Freigaben und gemeinsame Anlässe an einem Ort. Jubiläen nutzen automatisch das vorhandene Eintrittsdatum.</p>
    <QuestionBank />
    <TeamEvents />
    <WeeklyQuestionWidget />
    <FunFactsEditor />
    <TwoTruthsWidget />
  </section>;
}

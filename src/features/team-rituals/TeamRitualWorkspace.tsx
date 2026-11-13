import { BingoWidget, BingoSettings } from './BingoWidget';
import { FunFactsEditor } from './FunFactsEditor';
import { TwoTruthsWidget } from './TwoTruthsWidget';
import { QuestionBank } from './QuestionBank';
import { WeeklyQuestionWidget } from './WeeklyQuestionWidget';
import { TeamEvents } from './TeamEvents';
export function TeamRitualWorkspace() {
  return <section className="space-y-5" aria-label="Team-Rituale">
    <h2 className="text-xl font-semibold">Team-Rituale</h2>
    <p className="text-sm text-muted-foreground">Fragen, persönliche Freigaben und gemeinsame Anlässe an einem Ort. Jubiläen nutzen automatisch das vorhandene Eintrittsdatum.</p>
    <p className="text-sm text-muted-foreground">Die Auswahl läuft automatisch beim Aufrufen: Wochenfragen wechseln wöchentlich und dürfen sich nach einem Durchlauf wiederholen. Das Quiz wählt monatlich unverwendete Aussagen. Das Bingo wird je Person wöchentlich neu zusammengestellt.</p>
    <QuestionBank />
    <TeamEvents />
    <WeeklyQuestionWidget />
    <FunFactsEditor />
    <TwoTruthsWidget />
    <BingoSettings />
    <BingoWidget />
  </section>;
}

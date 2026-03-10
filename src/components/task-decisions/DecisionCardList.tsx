import type { ReactNode } from 'react';
import { DecisionRequest } from './utils/decisionOverview';

interface DecisionCardListProps {
  activeTab: string;
  filteredDecisions: DecisionRequest[];
  renderArchivedCard: (decision: DecisionRequest) => ReactNode;
  renderCompactCard: (decision: DecisionRequest) => ReactNode;
}

export const DecisionCardList = ({ activeTab, filteredDecisions, renderArchivedCard, renderCompactCard }: DecisionCardListProps) => {
  if (filteredDecisions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {activeTab === 'for-me' && 'Keine offenen Entscheidungen für Sie.'}
        {activeTab === 'answered' && 'Keine beantworteten Entscheidungen vorhanden.'}
        {activeTab === 'my-decisions' && 'Sie haben noch keine Entscheidungsanfragen erstellt.'}
        {activeTab === 'public' && 'Keine öffentlichen Entscheidungen vorhanden.'}
        {activeTab === 'questions' && 'Keine offenen Rückfragen vorhanden.'}
        {activeTab === 'archived' && 'Keine archivierten Entscheidungen vorhanden.'}
      </div>
    );
  }

  return <div className="space-y-3">{activeTab === 'archived' ? filteredDecisions.map(renderArchivedCard) : filteredDecisions.map(renderCompactCard)}</div>;
};

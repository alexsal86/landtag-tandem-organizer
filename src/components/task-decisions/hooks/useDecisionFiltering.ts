import { useState, useMemo, useEffect } from "react";
import type { DecisionTabId } from "@/hooks/useMyWorkSettings";
import { getResponseSummary } from "../utils/decisionOverview";
import type { DecisionRequest } from "../utils/decisionOverview";

interface UseDecisionFilteringOptions {
  decisions: DecisionRequest[];
  decisionTabOrder: DecisionTabId[];
  hiddenDecisionTabs: DecisionTabId[];
}

export function useDecisionFiltering({
  decisions,
  decisionTabOrder,
  hiddenDecisionTabs,
}: UseDecisionFilteringOptions) {
  const [activeTab, setActiveTab] = useState("for-me");
  const [searchQuery, setSearchQuery] = useState("");

  const configuredDecisionTabs = decisionTabOrder.filter(
    (tab) => !hiddenDecisionTabs.includes(tab),
  );

  // Sync activeTab if it becomes hidden
  useEffect(() => {
    if (configuredDecisionTabs.length === 0) return;
    if (
      ["for-me", "answered", "my-decisions", "public"].includes(activeTab) &&
      !configuredDecisionTabs.includes(activeTab as DecisionTabId)
    ) {
      setActiveTab(configuredDecisionTabs[0]);
    }
  }, [activeTab, configuredDecisionTabs]);

  const tabCounts = useMemo(() => {
    const active = decisions.filter((d) => d.status !== "archived");
    return {
      forMe: active.filter(
        (d) =>
          (d.isParticipant && !d.hasResponded && !d.isCreator) ||
          (d.isCreator &&
            (() => {
              const s = getResponseSummary(d.participants);
              return s.questionCount > 0 || (s.total > 0 && s.pending < s.total);
            })()),
      ).length,
      answered: active.filter((d) => d.isParticipant && d.hasResponded && !d.isCreator).length,
      myDecisions: active.filter((d) => d.isCreator).length,
      public: active.filter((d) => d.visible_to_all && !d.isCreator && !d.isParticipant).length,
      questions: active.filter((d) => {
        if (!d.isCreator) return false;
        const summary = getResponseSummary(d.participants);
        return summary.questionCount > 0;
      }).length,
      archived: decisions.filter((d) => d.status === "archived").length,
    };
  }, [decisions]);

  const decisionTabCounts: Record<DecisionTabId, number> = {
    "for-me": tabCounts.forMe,
    answered: tabCounts.answered,
    "my-decisions": tabCounts.myDecisions,
    public: tabCounts.public,
  };

  const decisionTabLabels: Record<DecisionTabId, string> = {
    "for-me": "Für mich",
    answered: "Beantwortet",
    "my-decisions": "Von mir",
    public: "Öffentlich",
  };

  const filteredDecisions = useMemo(() => {
    let filtered = decisions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          (d.description && d.description.toLowerCase().includes(query)),
      );
    }

    if (activeTab === "archived") {
      return filtered.filter((d) => d.status === "archived");
    }

    filtered = filtered.filter((d) => d.status !== "archived");

    switch (activeTab) {
      case "for-me": {
        const forMe = filtered.filter((d) => d.isParticipant && !d.hasResponded && !d.isCreator);
        const myWithActivity = filtered.filter((d) => {
          if (!d.isCreator) return false;
          const s = getResponseSummary(d.participants);
          return s.questionCount > 0 || (s.total > 0 && s.pending < s.total);
        });
        const ids = new Set(forMe.map((d) => d.id));
        return [...forMe, ...myWithActivity.filter((d) => !ids.has(d.id))];
      }
      case "answered":
        return filtered.filter((d) => d.isParticipant && d.hasResponded && !d.isCreator);
      case "my-decisions":
        return filtered.filter((d) => d.isCreator);
      case "public":
        return filtered.filter((d) => d.visible_to_all && !d.isCreator && !d.isParticipant);
      case "questions":
        return filtered.filter((d) => {
          if (!d.isCreator) return false;
          const summary = getResponseSummary(d.participants);
          return summary.questionCount > 0;
        });
      default:
        return filtered;
    }
  }, [decisions, activeTab, searchQuery]);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    configuredDecisionTabs,
    tabCounts,
    decisionTabCounts,
    decisionTabLabels,
    filteredDecisions,
  };
}

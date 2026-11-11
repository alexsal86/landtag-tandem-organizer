import styles from "./KnowledgeWorkspace.module.css";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import type { TenantProfileOption } from "@/hooks/useTenantProfiles";
import type { KnowledgeSummary } from "../types";
import { useKnowledgeWrite } from "../hooks/useKnowledgeQuestions";
import { knowledgePersonName } from "./presentation";

export function AssigneeSelect({
  question,
  profiles,
  assignable,
}: {
  question: Pick<KnowledgeSummary, 'id' | 'revision' | 'assigned_to'>;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
}) {
  const write = useKnowledgeWrite();
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <div className={styles.assignment}>
        <Label htmlFor={`assignee-${question.id}`}>Zuständig</Label>
        <select
          id={`assignee-${question.id}`}
          className={styles.select}
          value={question.assigned_to || ""}
          disabled={write.isPending}
          onChange={async (event) => {
            setError("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_set_assignee",
                args: {
                  p_question: question.id,
                  p_expected_revision: question.revision,
                  p_assigned_to: event.target.value || null,
                },
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Zuständigkeit konnte nicht geändert werden.",
              );
            }
          }}
        >
          <option value="">Noch nicht zugeordnet</option>
          {question.assigned_to &&
            !assignable.some(
              (profile) => profile.user_id === question.assigned_to,
            ) && (
              <option value={question.assigned_to}>
                {knowledgePersonName(profiles, question.assigned_to)}
              </option>
            )}
          {assignable.map((profile) => (
            <option key={profile.user_id} value={profile.user_id}>
              {profile.display_name || "Unbekannt"}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

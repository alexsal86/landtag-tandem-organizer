import styles from "./KnowledgeWorkspace.module.css";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TenantProfileOption } from "@/hooks/useTenantProfiles";
import type { KnowledgePerson, KnowledgeSummary } from "../types";
import { useKnowledgeWrite } from "../hooks/useKnowledgeQuestions";
import {
  KnowledgePersonAvatar,
  KnowledgePersonLabel,
} from "./KnowledgePersonAvatar";
import { knowledgePersonLabel } from "../person";

const UNASSIGNED = "__unassigned__";
export function AssigneeSelect({
  question,
  profiles,
  assignable,
  showAvatars = true,
}: {
  question: Pick<
    KnowledgeSummary,
    "id" | "revision" | "assigned_to" | "assigned_to_person"
  >;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
  showAvatars?: boolean;
}) {
  const write = useKnowledgeWrite();
  const [error, setError] = useState("");
  const selected: KnowledgePerson | null = question.assigned_to
    ? (question.assigned_to_person ?? {
        user_id: question.assigned_to,
        display_name:
          profiles.find((profile) => profile.user_id === question.assigned_to)
            ?.display_name ?? null,
        avatar_url:
          profiles.find((profile) => profile.user_id === question.assigned_to)
            ?.avatar_url ?? null,
      })
    : null;
  const options: KnowledgePerson[] = assignable.map((profile) => ({
    ...profile,
    avatar_url: profile.avatar_url ?? null,
  }));
  if (
    selected &&
    !options.some((person) => person.user_id === selected.user_id)
  )
    options.unshift(selected);
  return (
    <div className="space-y-2">
      <div className={styles.assignment}>
        <Label htmlFor={`assignee-${question.id}`}>Zuständig</Label>
        {showAvatars && <KnowledgePersonAvatar person={selected} />}
        <Select
          value={question.assigned_to || UNASSIGNED}
          disabled={write.isPending}
          onValueChange={async (value) => {
            setError("");
            try {
              await write.mutateAsync({
                name: "knowledge_qa_set_assignee",
                args: {
                  p_question: question.id,
                  p_expected_revision: question.revision,
                  p_assigned_to: value === UNASSIGNED ? null : value,
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
          <SelectTrigger
            id={`assignee-${question.id}`}
            className={`${styles.select} h-9 w-auto max-w-full gap-2 text-sm`}
          >
            <SelectValue>{knowledgePersonLabel(selected)}</SelectValue>
          </SelectTrigger>
          <SelectContent className={`${styles.theme} ${styles.assigneeMenu}`}>
            <SelectItem value={UNASSIGNED} textValue="Nicht zugeordnet">
              <KnowledgePersonLabel person={null} showAvatar={showAvatars} />
            </SelectItem>
            {options.map((person) => (
              <SelectItem
                key={person.user_id}
                value={person.user_id}
                textValue={knowledgePersonLabel(person)}
              >
                <KnowledgePersonLabel
                  person={person}
                  showAvatar={showAvatars}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

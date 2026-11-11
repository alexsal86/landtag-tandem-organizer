import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActionPermission } from "@/hooks/useActionPermission";
import { notify } from "@/lib/notify";
import { AskQuestionDialog } from "./AskQuestionDialog";
import { useKnowledgeScope } from "../hooks/useKnowledgeQuestions";
import { OPEN_KNOWLEDGE_QUESTION } from "../globalQuestion";

export function GlobalKnowledgeQuestionHost() {
  const { userId, tenantId } = useKnowledgeScope();
  return <QuestionHost key={`${userId}-${tenantId}`} />;
}

function QuestionHost() {
  const { userId, tenantId } = useKnowledgeScope();
  const { allowed } = useActionPermission("knowledge.write");
  const navigate = useNavigate();
  const [title, setTitle] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const canAsk = Boolean(userId && tenantId && allowed);
  useEffect(() => {
    if (!canAsk) return;
    const open = (initial: string) => {
      if (title !== null) return;
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setTitle(initial.slice(0, 300));
    };
    const requested = (event: Event) => {
      const initial: unknown = (event as CustomEvent<unknown>).detail;
      open(typeof initial === "string" ? initial : "");
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        !(event.ctrlKey || event.metaKey) ||
        !event.altKey ||
        event.shiftKey ||
        event.code !== "KeyF"
      )
        return;
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
        )
      )
        return;
      event.preventDefault();
      open("");
    };
    window.addEventListener(OPEN_KNOWLEDGE_QUESTION, requested);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener(OPEN_KNOWLEDGE_QUESTION, requested);
      window.removeEventListener("keydown", keydown);
    };
  }, [canAsk, title]);
  if (!canAsk || title === null) return null;
  return (
    <AskQuestionDialog
      initialQuestion={title}
      onClose={() => setTitle(null)}
      onReturnFocus={() => {
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
      }}
      onCreated={(id) => {
        setTitle(null);
        notify.success("Frage gestellt", {
          action: {
            label: "Frage öffnen",
            onClick: () => navigate(`/wissen?frage=${encodeURIComponent(id)}`),
          },
        });
      }}
    />
  );
}

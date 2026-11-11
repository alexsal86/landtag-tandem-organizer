import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useKnowledgeQuestion } from "../hooks/useKnowledgeQuestions";
import { KnowledgeQuestionDetailContent } from "./KnowledgeQuestionCard";
import type { TenantProfileOption } from "@/hooks/useTenantProfiles";
import styles from "./KnowledgeWorkspace.module.css";

export function KnowledgeDetailPanel({
  questionId,
  profiles,
  assignable,
  canWrite,
  canVerify,
  canManage,
  onClose,
  onReturnFocus,
}: {
  questionId: string | null;
  profiles: TenantProfileOption[];
  assignable: TenantProfileOption[];
  canWrite: boolean;
  canVerify: boolean;
  canManage: boolean;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const detail = useKnowledgeQuestion(questionId);
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => setCopyMessage(""), [questionId]);
  return (
    <Sheet
      open={Boolean(questionId)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className={`${styles.theme} ${styles.detailPanel}`}
        aria-modal="true"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <header className="mb-5 space-y-2 pr-8">
          <SheetTitle>{detail.data?.title || "Wissensfrage"}</SheetTitle>
          <SheetDescription>
            Antwort, Quellen und Änderungen dieser Frage.
          </SheetDescription>
        </header>
        <div className="mb-4 flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setCopyMessage("Link kopiert");
              } catch {
                setCopyMessage(
                  "Link konnte nicht kopiert werden. Die Adresse kann aus der Adresszeile kopiert werden.",
                );
              }
            }}
          >
            Link kopieren
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Schließen
          </Button>
        </div>
        {copyMessage && (
          <p role="status" className="mb-3 text-sm">
            {copyMessage}
          </p>
        )}
        {detail.isPending ? (
          <p role="status">Frage wird geladen …</p>
        ) : detail.isError ? (
          <p role="alert">
            Frage konnte nicht geladen werden.{" "}
            <button onClick={() => void detail.refetch()}>
              Erneut versuchen
            </button>
          </p>
        ) : detail.data ? (
          <KnowledgeQuestionDetailContent
            key={detail.data.id}
            question={detail.data}
            profiles={profiles}
            assignable={assignable}
            canWrite={canWrite}
            canVerify={canVerify}
            canManage={canManage}
            query=""
            showAvatars
          />
        ) : (
          <p>Frage nicht verfügbar.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

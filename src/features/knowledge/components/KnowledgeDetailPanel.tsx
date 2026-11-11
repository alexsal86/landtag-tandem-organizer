import { MoreHorizontal, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { KnowledgeFollowToggle } from "./KnowledgeConversationPanel";
import { KnowledgeStatusBadge } from "./KnowledgeStatusBadge";
import {
  ManagementPanel,
  type KnowledgeManagementMode,
} from "./ManagementPanel";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
  const [management, setManagement] = useState<KnowledgeManagementMode | null>(
    null,
  );
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const managementOpening = useRef(false);
  useEffect(() => {
    setCopyMessage("");
    setManagement(null);
  }, [questionId]);
  const manage = (mode: KnowledgeManagementMode) => {
    managementOpening.current = true;
    setManagement(mode);
  };
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
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <header className={styles.slideHeader}>
          <div className={styles.slideToolbar}>
            <div className="min-w-0">
              {detail.data && <KnowledgeStatusBadge question={detail.data} />}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {detail.data && (
                <KnowledgeFollowToggle
                  key={detail.data.id}
                  questionId={detail.data.id}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    ref={menuTrigger}
                    variant="outline"
                    className={styles.headerButton}
                    size="icon"
                    aria-label="Frage verwalten"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={styles.theme}
                  onCloseAutoFocus={(event) => {
                    if (managementOpening.current) {
                      event.preventDefault();
                      managementOpening.current = false;
                    }
                  }}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      void (async () => {
                        try {
                          await navigator.clipboard.writeText(
                            window.location.href,
                          );
                          setCopyMessage("Link kopiert");
                        } catch {
                          setCopyMessage(
                            "Link konnte nicht kopiert werden. Bitte die Adresse aus der Adresszeile kopieren.",
                          );
                        }
                      })();
                    }}
                  >
                    Link kopieren
                  </DropdownMenuItem>
                  {canManage && detail.data && (
                    <>
                      <DropdownMenuSeparator />
                      {detail.data.archived_at ? (
                        <DropdownMenuItem onSelect={() => manage("restore")}>
                          Wiederherstellen
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => manage("edit")}>
                            Frage bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => manage("merge")}>
                            Als Duplikat zusammenführen
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => manage("archive")}>
                            Archivieren / schließen
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className={styles.headerButton}
                size="icon"
                aria-label="Schließen"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
        <div className={styles.slideBody}>
          <section className={styles.questionIntro}>
            <SheetTitle className={styles.questionTitle}>
              {detail.data?.title || "Wissensfrage"}
            </SheetTitle>
            {detail.data?.description && (
              <div className={styles.questionDescription}>
                <h3>Beschreibung</h3>
                <p>{detail.data.description}</p>
              </div>
            )}
          </section>
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
        </div>
        {management && detail.data && (
          <ManagementPanel
            key={`${detail.data.id}-${management}`}
            question={detail.data}
            mode={management}
            onClose={() => setManagement(null)}
            onReturnFocus={() => menuTrigger.current?.focus()}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

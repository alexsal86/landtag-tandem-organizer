import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSafeKnowledgeSourceUrl } from "../logic";
import { formatKnowledgeAsOfDate } from "./presentation";
import { useState } from "react";
import {
  Link as LinkIcon,
  FileText,
  Scale,
  User,
  Briefcase,
  Ellipsis,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  KnowledgeCard,
  KnowledgeSource,
  KnowledgeSourceKind,
} from "../types";
import {
  useKnowledgeExtraWrite,
  useKnowledgeSources,
  useKnowledgeReferencePicker,
} from "../hooks/useKnowledgeExtras";
import styles from "./KnowledgeWorkspace.module.css";

const LABELS: Record<KnowledgeSourceKind, string> = {
  law: "Rechtsgrundlage",
  link: "Link",
  document: "Dokument",
  case: "Fallakte",
  person: "Person",
  other: "Sonstiges",
};
const ICONS = {
  link: LinkIcon,
  document: FileText,
  law: Scale,
  person: User,
  case: Briefcase,
  other: Ellipsis,
};
export function KnowledgeSourceList({
  sources,
}: {
  sources: KnowledgeSource[];
}) {
  if (!sources.length)
    return (
      <p className="text-sm text-muted-foreground">Keine Quelle angegeben</p>
    );
  return (
    <ul className="space-y-2">
      {sources.map((source) => {
        const Icon = ICONS[source.kind];
        const internal = source.document_id
          ? `/documents?tab=documents&highlight=${encodeURIComponent(source.document_id)}`
          : source.case_id
            ? `/casefiles?caseFileId=${encodeURIComponent(source.case_id)}`
            : null;
        const external =
          source.url && isSafeKnowledgeSourceUrl(source.url)
            ? source.url
            : null;
        return (
          <li key={source.id} className="flex items-start gap-2 text-sm">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              {internal ? (
                <a className="underline" href={internal}>
                  {source.title}
                </a>
              ) : external ? (
                <a
                  className="underline"
                  href={external}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              {source.as_of && (
                <span className="block text-xs text-muted-foreground">
                  Stand {formatKnowledgeAsOfDate(source.as_of)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
export function KnowledgeSourcesPanel({
  question,
  canWrite,
}: {
  question: KnowledgeCard;
  canWrite: boolean;
}) {
  const sources = useKnowledgeSources(question.id);
  const write = useKnowledgeExtraWrite();
  const [kind, setKind] = useState<KnowledgeSourceKind>("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [asOf, setAsOf] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const picker = useKnowledgeReferencePicker(kind, search);
  return (
    <section aria-label="Quellen" className={`${styles.slideCard} space-y-3`}>
      <h3 className="font-medium">Quellen</h3>
      {sources.isPending ? (
        <p>Quellen werden geladen …</p>
      ) : sources.isError ? (
        <p role="alert">Quellen konnten nicht geladen werden.</p>
      ) : (
        <KnowledgeSourceList sources={sources.data ?? []} />
      )}
      {canWrite && question.answered_at && !question.archived_at && (
        <>
          {sources.data?.map((source) => (
            <Button
              key={source.id}
              variant="ghost"
              size="sm"
              disabled={write.isPending}
              onClick={async () => {
                setError("");
                try {
                  await write.mutateAsync({
                    name: "knowledge_qa_remove_source",
                    args: {
                      p_source: source.id,
                      p_expected_revision: question.revision,
                    },
                  });
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Quelle konnte nicht entfernt werden.",
                  );
                }
              }}
              aria-label={`Quelle ${source.title} entfernen`}
            >
              Quelle entfernen: {source.title}
            </Button>
          ))}
          <details>
            <summary className="cursor-pointer text-sm">
              Quelle ergänzen
            </summary>
            <form
              className={styles.sourceGrid}
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                try {
                  if (url && !isSafeKnowledgeSourceUrl(url))
                    throw new Error("Nur http- und https-URLs sind erlaubt.");
                  await write.mutateAsync({
                    name: "knowledge_qa_add_source",
                    args: {
                      p_question: question.id,
                      p_expected_revision: question.revision,
                      p_kind: kind,
                      p_title: title.trim(),
                      p_url: url || undefined,
                      p_document: kind === "document" ? selected : undefined,
                      p_case: kind === "case" ? selected : undefined,
                      p_as_of: asOf || undefined,
                    },
                  });
                  setTitle("");
                  setUrl("");
                  setSelected("");
                  setSearch("");
                  setAsOf("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Quelle konnte nicht gespeichert werden.",
                  );
                }
              }}
            >
              <div className={styles.sourceField}>
                <Label htmlFor="source-kind">Quellentyp</Label>
                <Select
                  value={kind}
                  onValueChange={(value: KnowledgeSourceKind) => {
                    setKind(value);
                    setSelected("");
                    setSearch("");
                    setUrl("");
                    setTitle("");
                  }}
                >
                  <SelectTrigger id="source-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={styles.theme}>
                    {Object.entries(LABELS).map(([key, label]) => {
                      const Icon = ICONS[key as KnowledgeSourceKind];
                      return (
                        <SelectItem key={key} value={key}>
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {kind === "document" || kind === "case" ? (
                <div className={styles.sourceField}>
                  <Label htmlFor="source-search">
                    {kind === "document"
                      ? "Dokument suchen"
                      : "Fallakte suchen"}
                  </Label>
                  <Input
                    id="source-search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setSelected("");
                    }}
                  />
                  <Label htmlFor="source-reference">
                    Sichtbaren Eintrag auswählen
                  </Label>
                  <select
                    id="source-reference"
                    className={styles.select}
                    required
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    <option value="">Bitte auswählen</option>
                    {picker.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  {picker.isError && (
                    <p role="alert">Einträge konnten nicht geladen werden.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.sourceField}>
                    <Label htmlFor="source-title">Titel</Label>
                    <Input
                      id="source-title"
                      required
                      maxLength={300}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                  <div className={`${styles.sourceField} ${styles.sourceFull}`}>
                    <Label htmlFor="source-url">
                      URL {kind !== "link" && "(optional)"}
                    </Label>
                    <Input
                      id="source-url"
                      type="url"
                      maxLength={2048}
                      required={kind === "link"}
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                    />
                  </div>
                </>
              )}
              <div className={styles.sourceField}>
                <Label htmlFor="source-date">Stand (optional)</Label>
                <Input
                  id="source-date"
                  type="date"
                  value={asOf}
                  onChange={(event) => setAsOf(event.target.value)}
                />
              </div>
              <Button
                className="self-end"
                variant="outline"
                disabled={
                  write.isPending ||
                  sources.isPending ||
                  sources.isError ||
                  (sources.data?.length ?? 0) >= 10
                }
              >
                Quelle speichern
              </Button>
            </form>
          </details>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

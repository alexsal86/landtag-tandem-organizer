import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Highlighter, MousePointer2, Square, Pentagon, ZoomIn, ZoomOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingState, ErrorState } from "@/components/ui-patterns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { ANNOTATION_COLORS, fileVersionOf, getAnnotationFileKind } from "../annotationModel";
import { useAnnotations } from "../useAnnotations";
import { colorVar } from "./AnnotationShapes";
import { PdfAnnotator } from "./PdfAnnotator";
import { ImageAnnotator } from "./ImageAnnotator";
import { useAnnotationZoom } from "./useAnnotationZoom";
import { AnnotationSidebar } from "./AnnotationSidebar";
import type { AnnotatableDocument, AnnotationColor, AnnotationTool, DraftAnnotation, AnnotationSelector, DocumentAnnotation } from "../types";

interface Props { document: AnnotatableDocument | null; open: boolean; onOpenChange: (o: boolean) => void }

export function AnnotationWorkspace({ document: doc, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const viewerRef = useRef<HTMLDivElement>(null);
  const kind = doc ? getAnnotationFileKind(doc.file_name, doc.file_type) : null;
  const [tool, setTool] = useState<AnnotationTool>("select");
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const { zoom, changeZoom } = useAnnotationZoom(viewerRef, open ? doc?.id : undefined);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { annotations, create, update, remove } = useAnnotations(open && doc ? doc.id : null);

  useEffect(() => { if (!open) { setDraft(null); setActiveId(null); setTool("select"); } }, [open]);
  useEffect(() => { if (kind === "pdf" && tool === "polygon") setTool("rect"); }, [kind, tool]);

  const file = useQuery({
    queryKey: ["annotation-file", doc?.file_path],
    enabled: open && !!doc && !!kind,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("documents").download(doc!.file_path);
      if (error) throw error;
      return data;
    },
  });
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.data) return;
    let url: string | null = null;
    if (kind === "pdf") void file.data.arrayBuffer().then(setBuffer);
    else { url = URL.createObjectURL(file.data); setImgUrl(url); }
    return () => { if (url) URL.revokeObjectURL(url); setBuffer(null); setImgUrl(null); };
  }, [file.data, kind]);

  const authorIds = useMemo(() => Array.from(new Set(annotations.map(a => a.created_by))), [annotations]);
  const authors = useQuery({
    queryKey: ["annotation-authors", authorIds.join(",")],
    enabled: authorIds.length > 0, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", authorIds);
      return Object.fromEntries((data ?? []).map(r => [r.user_id, r.display_name ?? "Unbekannt"])) as Record<string, string>;
    },
  });
  const roles = useQuery({
    queryKey: ["annotation-moderator", user?.id], enabled: !!user?.id, staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).some(r => r.role === "abgeordneter" || r.role === "bueroleitung");
    },
  });

  if (!doc || !open) return null;
  const version = fileVersionOf(doc);

  const saveDraft = (content: string) => {
    if (!draft || !user || !kind) return;
    create.mutate({ tenantId: doc.tenant_id, fileKind: kind, fileVersion: version, draft, color, content, userId: user.id }, {
      onSuccess: () => { setDraft(null); notify.success("Anmerkung gespeichert"); },
      onError: () => notify.error("Anmerkung konnte nicht gespeichert werden"),
    });
  };
  const selectAnnotation = (id: string) => {
    const selected = annotations.find(a => a.id === id);
    const targetId = selected?.parent_id ?? id;
    setActiveId(targetId);
    const shape = viewerRef.current?.querySelector(`[data-annotation-id="${targetId}"]`);
    const page = viewerRef.current?.querySelector(`[data-annotation-page="${selected?.page_number ?? 1}"]`);
    (shape ?? page)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  };
  const reply = async (parentId: string, content: string): Promise<boolean> => {
    const parent = annotations.find(a => a.id === parentId);
    if (!parent || !user || !kind) return false;
    try {
      await create.mutateAsync({ tenantId: doc.tenant_id, fileKind: kind, fileVersion: parent.file_version ?? version,
      draft: parent, color: parent.color, content, userId: user.id, parentId });
      notify.success("Antwort gespeichert");
      return true;
    } catch {
      notify.error("Antwort konnte nicht gespeichert werden");
      return false;
    }
  };
  const canEditPosition = (annotation: DocumentAnnotation) => annotation.created_by === user?.id || !!roles.data;
  const changePosition = async (id: string, selector: AnnotationSelector) => {
    try { await update.mutateAsync({ id, patch: { target_selector: selector } }); }
    catch (error) { notify.error("Position konnte nicht gespeichert werden"); throw error; }
  };
  const startDraft = (next: DraftAnnotation) => { setDraft(next); setActiveId("__draft__"); setTool("select"); };
  const err = () => notify.error("Änderung nicht möglich");

  const tools: { id: AnnotationTool; label: string; icon: typeof Square; show: boolean }[] = [
    { id: "select", label: "Auswählen", icon: MousePointer2, show: true },
    { id: "highlight", label: "Text markieren", icon: Highlighter, show: kind === "pdf" },
    { id: "rect", label: "Bereich markieren (ziehen)", icon: Square, show: true },
    { id: "polygon", label: "Polygon (klicken, Doppelklick beendet)", icon: Pentagon, show: kind === "image" },
  ];

  return (
    <section aria-label="Dokument annotieren" className="flex h-[calc(100dvh-6rem)] min-h-[520px] min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
        <TooltipProvider>
          <header className="flex flex-wrap items-center gap-sm border-b px-md py-sm">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-title">{doc.title}</h2>
              <p className="truncate text-caption">{doc.file_name} · Originaldatei bleibt unverändert</p>
            </div>
            <div className="flex items-center gap-2xs rounded-md border p-2xs">
              {tools.filter(t => t.show).map(t => (
                <Tooltip key={t.id}><TooltipTrigger asChild>
                  <Button size="sm" variant={tool === t.id ? "secondary" : "ghost"} className="h-8 w-8 p-0" aria-label={t.label} onClick={() => setTool(t.id)}><t.icon className="h-4 w-4" /></Button>
                </TooltipTrigger><TooltipContent>{t.label}</TooltipContent></Tooltip>
              ))}
            </div>
            <div className="flex items-center gap-2xs">
              {ANNOTATION_COLORS.map(c => (
                <Tooltip key={c.value}><TooltipTrigger asChild>
                  <button aria-label={c.label} onClick={() => setColor(c.value)}
                    className={`h-6 w-6 rounded-pill border-2 ${color === c.value ? "border-foreground" : "border-transparent"}`} style={{ background: `hsl(${colorVar(c.value)})` }} />
                </TooltipTrigger><TooltipContent>{c.label}</TooltipContent></Tooltip>
              ))}
            </div>
            <div className="flex items-center gap-2xs">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Verkleinern" onClick={() => changeZoom(z => z - 0.25)}><ZoomOut className="h-4 w-4" /></Button>
              <span className="w-12 text-center text-caption tabular-nums">{Math.round(zoom * 100)} %</span>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Vergrößern" onClick={() => changeZoom(z => z + 0.25)}><ZoomIn className="h-4 w-4" /></Button>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Zurück zu den Dokumenten" title="Zurück zu den Dokumenten" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </header>
        </TooltipProvider>
        <p className="border-b px-md py-xs text-caption text-muted-foreground">
          Auswählen: Markierung ziehen · Kreise: Ecken anpassen · Mausrad: zoomen · Shift + Mausrad: scrollen · Esc: Zeichnung abbrechen
        </p>
        <div className="flex min-h-0 flex-1">
          <div ref={viewerRef} className="min-w-0 flex-1 overflow-auto bg-muted/40 [scrollbar-gutter:stable]">
            {!kind ? <ErrorState title="Dateityp nicht unterstützt" description="Annotation ist für PDF, JPG, PNG und WebP möglich." />
              : file.isError ? <ErrorState title="Datei konnte nicht geladen werden" />
              : kind === "pdf" ? (buffer ? <PdfAnnotator data={buffer} zoom={zoom} tool={tool} color={color} annotations={annotations} activeId={activeId} draft={draft} onSelect={setActiveId} onDraft={startDraft} canEdit={canEditPosition} onChange={changePosition} onDraftChange={selector => setDraft(current => current ? { ...current, target_selector: selector } : null)} /> : <LoadingState label="Datei wird geladen…" />)
              : imgUrl ? <ImageAnnotator src={imgUrl} alt={doc.title} zoom={zoom} tool={tool} color={color} annotations={annotations} activeId={activeId} draft={draft} onSelect={setActiveId} onDraft={startDraft} canEdit={canEditPosition} onChange={changePosition} onDraftChange={selector => setDraft(current => current ? { ...current, target_selector: selector } : null)} />
              : <LoadingState label="Datei wird geladen…" />}
          </div>
          <AnnotationSidebar tenantId={doc.tenant_id} onReply={reply} saving={create.isPending} annotations={annotations} activeId={activeId} draft={draft} draftColor={color} currentVersion={version}
            userId={user?.id} canModerate={!!roles.data} authorName={id => id === user?.id ? "Du" : authors.data?.[id] ?? "…"}
            onSelect={selectAnnotation} onSaveDraft={saveDraft} onCancelDraft={() => setDraft(null)}
            onUpdate={(id, patch) => update.mutate({ id, patch }, { onError: err })}
            onDelete={id => remove.mutate(id, { onError: err })} />
        </div>
    </section>
  );
}

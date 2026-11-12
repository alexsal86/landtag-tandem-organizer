import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Highlighter, MousePointer2, Square, Pentagon, ZoomIn, ZoomOut, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { AnnotationSidebar } from "./AnnotationSidebar";
import type { AnnotatableDocument, AnnotationColor, AnnotationTool, DraftAnnotation } from "../types";

interface Props { document: AnnotatableDocument | null; open: boolean; onOpenChange: (o: boolean) => void }

export function AnnotationWorkspaceDialog({ document: doc, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const kind = doc ? getAnnotationFileKind(doc.file_name, doc.file_type) : null;
  const [tool, setTool] = useState<AnnotationTool>("select");
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { annotations, create, update, remove } = useAnnotations(open && doc ? doc.id : null);

  useEffect(() => { if (!open) { setDraft(null); setActiveId(null); setTool("select"); setZoom(1); } }, [open]);
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

  if (!doc) return null;
  const version = fileVersionOf(doc);

  const saveDraft = (content: string) => {
    if (!draft || !user || !kind) return;
    create.mutate({ tenantId: doc.tenant_id, fileKind: kind, fileVersion: version, draft, color, content, userId: user.id }, {
      onSuccess: () => { setDraft(null); notify.success("Anmerkung gespeichert"); },
      onError: () => notify.error("Anmerkung konnte nicht gespeichert werden"),
    });
  };
  const err = () => notify.error("Änderung nicht möglich");

  const tools: { id: AnnotationTool; label: string; icon: typeof Square; show: boolean }[] = [
    { id: "select", label: "Auswählen", icon: MousePointer2, show: true },
    { id: "highlight", label: "Text markieren", icon: Highlighter, show: kind === "pdf" },
    { id: "rect", label: "Bereich markieren (ziehen)", icon: Square, show: true },
    { id: "polygon", label: "Polygon (klicken, Doppelklick beendet)", icon: Pentagon, show: kind === "image" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 [&>button]:hidden">
        <TooltipProvider>
          <header className="flex items-center gap-sm border-b px-md py-sm">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-title">{doc.title}</DialogTitle>
              <DialogDescription className="truncate text-caption">{doc.file_name} · Originaldatei bleibt unverändert</DialogDescription>
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
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Verkleinern" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="w-12 text-center text-caption tabular-nums">{Math.round(zoom * 100)} %</span>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Vergrößern" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}><ZoomIn className="h-4 w-4" /></Button>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Schließen" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </header>
        </TooltipProvider>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-auto bg-muted/40">
            {!kind ? <ErrorState title="Dateityp nicht unterstützt" description="Annotation ist für PDF, JPG, PNG und WebP möglich." />
              : file.isError ? <ErrorState title="Datei konnte nicht geladen werden" />
              : kind === "pdf" ? (buffer ? <PdfAnnotator data={buffer} zoom={zoom} tool={tool} color={color} annotations={annotations} activeId={activeId} draft={draft} onSelect={setActiveId} onDraft={setDraft} /> : <LoadingState label="Datei wird geladen…" />)
              : imgUrl ? <ImageAnnotator src={imgUrl} alt={doc.title} zoom={zoom} tool={tool} color={color} annotations={annotations} activeId={activeId} draft={draft} onSelect={setActiveId} onDraft={setDraft} />
              : <LoadingState label="Datei wird geladen…" />}
          </div>
          <AnnotationSidebar annotations={annotations} activeId={activeId} draft={draft} draftColor={color} currentVersion={version}
            userId={user?.id} canModerate={!!roles.data} authorName={id => id === user?.id ? "Du" : authors.data?.[id] ?? "…"}
            onSelect={setActiveId} onSaveDraft={saveDraft} onCancelDraft={() => setDraft(null)}
            onUpdate={(id, patch) => update.mutate({ id, patch }, { onError: err })}
            onDelete={id => remove.mutate(id, { onError: err })} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

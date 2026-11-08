import { useEffect, useRef, useState } from "react";
import { Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { CROP_FORMATS, computeCropRect, type CropFormat } from "@/features/redaktion/utils/plannerRules";

interface Props {
  open: boolean;
  /** File (new upload) or URL (existing image) to crop. */
  source: File | string | null;
  onOpenChange: (open: boolean) => void;
  /** Receives the cropped JPEG; null means "use original". */
  onConfirm: (result: { blob: Blob | null; formatId: CropFormat["id"] | null }) => Promise<void> | void;
}

export function ImageCropDialog({ open, source, onOpenChange, onConfirm }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [formatId, setFormatId] = useState<CropFormat["id"]>("4:5");
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = CROP_FORMATS.find((f) => f.id === formatId) ?? CROP_FORMATS[0];

  useEffect(() => {
    if (!open || !source) { setImg(null); return; }
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.onerror = () => notify.error("Bild konnte nicht geladen werden");
    image.src = url;
    setFocusX(50); setFocusY(50);
    return () => { if (typeof source !== "string") URL.revokeObjectURL(url); };
  }, [open, source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const rect = computeCropRect(img.naturalWidth, img.naturalHeight, format.ratio, focusX / 100, focusY / 100);
    canvas.width = format.outputWidth;
    canvas.height = Math.round(format.outputWidth / format.ratio);
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);
  }, [img, format, focusX, focusY]);

  const confirm = async (useCrop: boolean) => {
    setBusy(true);
    try {
      if (!useCrop) { await onConfirm({ blob: null, formatId: null }); onOpenChange(false); return; }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob = await new Promise<Blob | null>((resolve) => {
        try { canvas.toBlob(resolve, "image/jpeg", 0.88); } catch { resolve(null); }
      });
      if (!blob) { notify.error("Zuschnitt nicht möglich", { description: "Das Bild erlaubt keinen Zuschnitt im Browser." }); return; }
      await onConfirm({ blob, formatId });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crop className="h-4 w-4" /> Bild zuschneiden</DialogTitle>
          <DialogDescription>Format wählen und den Bildausschnitt verschieben, damit nichts Wichtiges abgeschnitten wird.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bildformat">
          {CROP_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={f.id === formatId}
              onClick={() => setFormatId(f.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                f.id === formatId ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="block font-medium">{f.label}</span>
              <span className="block text-xs">{f.hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="flex items-center justify-center rounded-md border bg-muted/40 p-2">
            {img ? (
              <canvas ref={canvasRef} className="max-h-[340px] max-w-full rounded-sm shadow-sm" />
            ) : (
              <p className="py-16 text-sm text-muted-foreground">Bild wird geladen…</p>
            )}
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Ausschnitt waagerecht</Label>
              <Slider value={[focusX]} min={0} max={100} step={1} onValueChange={([v]) => setFocusX(v)} aria-label="Ausschnitt waagerecht" />
            </div>
            <div className="space-y-2">
              <Label>Ausschnitt senkrecht</Label>
              <Slider value={[focusY]} min={0} max={100} step={1} onValueChange={([v]) => setFocusY(v)} aria-label="Ausschnitt senkrecht" />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {source instanceof File && (
            <Button type="button" variant="ghost" className="mr-auto" disabled={busy} onClick={() => void confirm(false)}>Original verwenden</Button>
          )}
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button type="button" disabled={busy || !img} onClick={() => void confirm(true)}>{busy ? "Speichere…" : "Zuschnitt übernehmen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

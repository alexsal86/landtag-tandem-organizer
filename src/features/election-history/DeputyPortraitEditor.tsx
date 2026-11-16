import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { PORTRAIT_SIZE, PORTRAIT_THUMB, portraitCrop, portraitDirectory, portraitSource, isDeputyPortrait, webpBlob, blobBase64, type DeputyPortrait, type PortraitSource } from './portrait';

type Props = { connectionId: string; name: string; current: DeputyPortrait | null; initialImage?: Blob; onClose: () => void; onSaved: (metadata: DeputyPortrait, preview: Blob) => void };
export function DeputyPortraitEditor({ connectionId, name, current, initialImage, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [source, setSource] = useState<PortraitSource>(current?.source || { label: '', url: '', author: '', license: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const crop = image ? portraitCrop(image.naturalWidth, image.naturalHeight, zoom, position.x, position.y) : null;
  useEffect(() => {
    const local = file || initialImage;
    if (!local && !current) return;
    const url = local ? URL.createObjectURL(local) : `${portraitDirectory(connectionId)}${current!.image}`; let active = true;
    setImageUrl(url); setImage(null); setZoom(1); setPosition({ x: 0, y: 0 });
    const loaded = new Image();
    loaded.onload = () => { if (active) { if (loaded.naturalWidth * loaded.naturalHeight > 60_000_000) setError('Bitte ein Bild mit höchstens 60 Megapixeln wählen.'); else setImage(loaded); } };
    loaded.onerror = () => { if (active) setError('Das Bild konnte nicht gelesen werden. Bitte JPEG, PNG oder WebP wählen.'); };
    loaded.src = url;
    return () => { active = false; if (local) URL.revokeObjectURL(url); };
  }, [file, initialImage, current?.image, connectionId]);
  const move = (x: number, y: number) => {
    if (!image) return;
    const next = portraitCrop(image.naturalWidth, image.naturalHeight, zoom, x, y);
    setPosition({ x: next.offsetX, y: next.offsetY });
  };
  const save = async () => {
    if (!image || !crop || saving) return;
    if (!portraitSource(source)) { setError('Bitte eine gültige Quellen-URL mit https:// oder http:// angeben.'); return; }
    setSaving(true); setError('');
    try {
      const canvas = document.createElement('canvas'); canvas.width = PORTRAIT_SIZE.width; canvas.height = PORTRAIT_SIZE.height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Bildverarbeitung ist in diesem Browser nicht verfügbar.');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, 0, 0, canvas.width, canvas.height);
      const detail = await webpBlob(canvas, PORTRAIT_SIZE.maxBytes);
      const small = document.createElement('canvas'); small.width = PORTRAIT_THUMB.width; small.height = PORTRAIT_THUMB.height;
      const smallCtx = small.getContext('2d'); if (!smallCtx) throw new Error('Die Bildvorschau konnte nicht erstellt werden.');
      smallCtx.imageSmoothingEnabled = true; smallCtx.imageSmoothingQuality = 'high'; smallCtx.drawImage(canvas, 0, 0, small.width, small.height);
      const thumbnail = await webpBlob(small, PORTRAIT_THUMB.maxBytes);
      const { data, error: uploadError } = await supabase.functions.invoke('save-deputy-portrait', { body: {
        connectionId, expectedVersion: current?.version || null, source,
        image: await blobBase64(detail), thumbnail: await blobBase64(thumbnail),
      } });
      if (uploadError) {
        let message = 'Der GitHub-Upload ist fehlgeschlagen. Bitte die Server-Konfiguration und Verbindung prüfen.';
        try { const response = await uploadError.context?.json(); if (typeof response?.error?.message === 'string') message = response.error.message; } catch { /* Keep the safe fallback. */ }
        throw new Error(message);
      }
      if (!isDeputyPortrait(data?.metadata, connectionId)) throw new Error('Der Server hat keine gültige Bildbestätigung geliefert.');
      onSaved(data.metadata, detail);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Das Bild konnte nicht gespeichert werden.'); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Porträt für {name}</DialogTitle></DialogHeader>
    <fieldset disabled={saving} className="space-y-4">
      <div><Label htmlFor="deputy-portrait-file">Bild auswählen</Label><Input id="deputy-portrait-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const next = event.target.files?.[0]; if (!next) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 15 * 1024 * 1024) { setError('Bitte JPEG, PNG oder WebP mit höchstens 15 MB wählen.'); event.target.value = ''; return; }
        setError(''); setFile(next);
      }} /></div>
      {image && crop && <div className="space-y-3">
        <div role="group" tabIndex={0} aria-label="Bildausschnitt verschieben: ziehen oder Pfeiltasten verwenden" className="relative mx-auto h-80 w-60 touch-none overflow-hidden rounded-md border bg-muted outline-offset-4 cursor-move"
          onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, offsetX: crop.offsetX, offsetY: crop.offsetY }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (drag.current) move(drag.current.offsetX + event.clientX - drag.current.x, drag.current.offsetY + event.clientY - drag.current.y); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={event => { const delta: Record<string, [number, number]> = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }; if (delta[event.key]) { event.preventDefault(); move(crop.offsetX + delta[event.key][0], crop.offsetY + delta[event.key][1]); } }}>
          <img alt="Vorschau des Porträtausschnitts" src={imageUrl} draggable={false} className="pointer-events-none absolute select-none" style={{ maxWidth: 'none', width: image.naturalWidth * crop.scale, height: image.naturalHeight * crop.scale, left: (240 - image.naturalWidth * crop.scale) / 2 + crop.offsetX, top: (320 - image.naturalHeight * crop.scale) / 2 + crop.offsetY }} />
        </div>
        <p className="text-center text-xs text-muted-foreground">Bild verschieben und mit Zoom in den 3:4-Rahmen einpassen.</p>
        <Label htmlFor="deputy-portrait-zoom">Zoom</Label><Slider id="deputy-portrait-zoom" aria-label="Porträt vergrößern" value={[zoom]} min={1} max={4} step={0.01} onValueChange={([value]) => { setZoom(value); const next = portraitCrop(image.naturalWidth, image.naturalHeight, value, crop.offsetX, crop.offsetY); setPosition({ x: next.offsetX, y: next.offsetY }); }} />
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">{([{ key: 'label', label: 'Quelle / Bildnachweis' }, { key: 'url', label: 'Quellen-URL' }, { key: 'author', label: 'Fotograf/in / Urheber/in' }, { key: 'license', label: 'Lizenz / Nutzungshinweis' }] as const).map(field => <div key={field.key}><Label htmlFor={`portrait-source-${field.key}`}>{field.label}</Label><Input id={`portrait-source-${field.key}`} type={field.key === 'url' ? 'url' : 'text'} maxLength={field.key === 'url' ? 2048 : 500} value={source[field.key]} onChange={event => setSource(previous => ({ ...previous, [field.key]: event.target.value }))} /></div>)}</div>
      <p className="text-xs text-muted-foreground">WebP · 480 × 640 Pixel plus kleine Vorschau. Bild und Bildnachweis werden öffentlich mit der Website ausgeliefert.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </fieldset>
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Abbrechen</Button><Button disabled={!image || saving} onClick={() => void save()}>{saving ? 'Speichert in GitHub …' : 'Ausschnitt in GitHub speichern'}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

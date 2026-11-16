export { PORTRAIT_SIZE, PORTRAIT_LARGE, PORTRAIT_THUMB, PORTRAIT_ID, portraitCrop, portraitSource, isDeputyPortrait, validPortraitWebp } from '../../../supabase/functions/_shared/deputyPortrait';
export type { DeputyPortrait, PortraitSource } from '../../../supabase/functions/_shared/deputyPortrait';

export function portraitDirectory(id: string) {
  return `${import.meta.env.BASE_URL}images/abgeordnete/${id}/`;
}

export async function webpBlob(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  for (const quality of [0.82, 0.72, 0.62, 0.5, 0.38]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp') throw new Error('Dieser Browser kann keine WebP-Bilder erzeugen. Bitte einen aktuellen Browser verwenden.');
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error('Das Bild lässt sich nicht ausreichend verkleinern. Bitte einen engeren Ausschnitt wählen.');
}

export async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

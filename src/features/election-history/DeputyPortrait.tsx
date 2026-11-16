import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeputyPortraitEditor } from './DeputyPortraitEditor';
import { PORTRAIT_ID, isDeputyPortrait, portraitDirectory, type DeputyPortrait as PortraitData } from './portrait';

export function useDeputyPortrait(connectionId: string) {
  return useQuery({
    queryKey: ['deputy-portrait', connectionId], enabled: PORTRAIT_ID.test(connectionId),
    queryFn: async ({ signal }): Promise<PortraitData | null> => {
      const response = await fetch(`${portraitDirectory(connectionId)}portrait.json`, { signal, cache: 'no-cache' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Der Bildnachweis konnte nicht geladen werden.');
      // SPA hosts return index.html for an as-yet nonexistent public file.
      if (!response.headers.get('content-type')?.includes('json')) return null;
      const text = await response.text(); if (text.length > 8192) throw new Error('Ungültiger Bildnachweis.');
      const value: unknown = JSON.parse(text);
      if (!isDeputyPortrait(value, connectionId)) throw new Error('Ungültiger Bildnachweis.');
      return value;
    }, retry: false, staleTime: 60_000, gcTime: 300_000, refetchOnWindowFocus: false,
  });
}

export function DeputyPortraitThumbnail({ connectionId, name }: { connectionId: string; name: string }) {
  const query = useDeputyPortrait(connectionId);
  const [failed, setFailed] = useState(false);
  if (!query.data || failed) return <span className="flex h-16 w-12 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground" aria-hidden="true"><UserRound className="h-6 w-6" /></span>;
  return <img src={`${portraitDirectory(connectionId)}${query.data.thumbnail}`} alt={`Porträt von ${name}`} width={48} height={64} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-16 w-12 shrink-0 rounded border object-cover" />;
}

export function DeputyPortrait({ connectionId, name, editable, variant = 'default' }: { connectionId: string; name: string; editable: boolean; variant?: 'default' | 'editorial' }) {
  const editorial = variant === 'editorial';
  const query = useDeputyPortrait(connectionId);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<{ metadata: PortraitData; preview: Blob } | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (!saved) return; const url = URL.createObjectURL(saved.preview); setPreviewUrl(url); return () => URL.revokeObjectURL(url); }, [saved]);
  const metadata = saved?.metadata || query.data || null;
  const src = saved ? previewUrl : metadata ? `${portraitDirectory(connectionId)}${metadata.largeImage || metadata.image}` : '';
  const validConnection = PORTRAIT_ID.test(connectionId);
  const portraitNotes = <>
        {metadata && <div className="space-y-1 text-muted-foreground">
          {metadata.source.label && <p>Quelle: {metadata.source.label}</p>}
          {metadata.source.author && <p>Foto: {metadata.source.author}</p>}
          {metadata.source.license && <p>{metadata.source.license}</p>}
          {metadata.source.url && <a className="inline-block break-all underline" href={metadata.source.url} target="_blank" rel="noopener noreferrer">Bildquelle öffnen</a>}
        </div>}
        {editable && validConnection && <Button size="sm" variant="outline" disabled={query.isFetching || !!query.error} onClick={() => setEditing(true)}><ImagePlus className="mr-2 h-4 w-4" />{metadata ? 'Bild / Bildnachweis ändern' : 'Bild hochladen'}</Button>}
        {editable && !validConnection && <p className="text-xs text-muted-foreground">Das Bild kann nach dem Zusammenfassen der Mandatszeiten ergänzt werden.</p>}
        {query.error && <div role="alert"><p className="text-xs">Der Bildnachweis konnte nicht geladen werden.</p><Button size="sm" variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button></div>}
        {saved && <p role="status" className="text-xs text-muted-foreground">In GitHub gespeichert. Die Website zeigt das Bild nach dem nächsten Lovable-Deployment für alle an. Hier siehst du bereits deine Vorschau.</p>}
  </>;
  return <section aria-label={`Porträt von ${name}`} className={editorial ? 'deputy-profile-portrait' : 'space-y-3'}>
    <div className={editorial ? 'deputy-editorial-portrait' : 'flex flex-wrap items-start gap-4'}>
      <div className={editorial ? 'deputy-profile-photo' : 'contents'}>
      {src && !failed ? <img src={src} alt={`Porträt von ${name}`} width={160} height={213} decoding="async" className="aspect-[3/4] w-40 rounded-md border object-cover" onError={() => setFailed(true)} />
        : <div className="flex aspect-[3/4] w-32 items-center justify-center rounded-md border bg-muted text-muted-foreground" aria-label="Noch kein Porträt vorhanden">{editorial ? <span className="deputy-profile-initials" aria-hidden="true">{name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span> : <UserRound className="h-12 w-12" aria-hidden="true" />}</div>}
      </div>
      <div className={editorial ? 'deputy-profile-photo-notes min-w-0 space-y-2 text-sm' : 'min-w-0 flex-1 space-y-2 text-sm'}>
        {editorial ? <>
          {src && !failed && metadata?.source.author && <p className="deputy-profile-credit">Foto: {metadata.source.author}</p>}
          <details className="deputy-profile-photo-details">
            <summary>Bildnachweis{editable ? ' / Bild bearbeiten' : ''}</summary>
            <div className="deputy-profile-photo-details-content space-y-2">{portraitNotes}</div>
          </details>
        </> : portraitNotes}
      </div>
    </div>
    {editing && <DeputyPortraitEditor connectionId={connectionId} name={name} current={metadata} initialImage={saved?.preview} onClose={() => setEditing(false)} onSaved={(next, preview) => { setSaved({ metadata: next, preview }); setFailed(false); setEditing(false); }} />}
  </section>;
}

import { callerClient, requireAuth, unauthorizedResponse, forbiddenResponse, badRequestResponse, jsonResponse, withSafeHandler } from '../_shared/security.ts';
import { PORTRAIT_ID, PORTRAIT_SIZE, PORTRAIT_LARGE, PORTRAIT_THUMB, portraitSource, isDeputyPortrait, validPortraitWebp, type DeputyPortrait } from '../_shared/deputyPortrait.ts';

// Platform-wide catalog operation, authorized only by is_superadmin; no tenant data is changed.
const REPOSITORY = 'alexsal86/landtag-tandem-organizer';
const BRANCH = 'main';
const MAX_BODY = 750_000;
const fail = (status: number, code: string, message: string) => jsonResponse({ error: { code, message } }, status);

async function boundedJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!req.body) return null;
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > MAX_BODY) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
function decodeImage(value: unknown, thumb: boolean | 'large'): Uint8Array | null {
  const limits = thumb === 'large' ? PORTRAIT_LARGE : thumb ? PORTRAIT_THUMB : PORTRAIT_SIZE;
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(limits.maxBytes / 3) || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
  try { const binary = atob(value); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return validPortraitWebp(bytes, thumb) ? bytes : null; }
  catch { return null; }
}
async function digest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

Deno.serve(withSafeHandler('save-deputy-portrait', async req => {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Nur POST ist erlaubt.');
  const auth = await requireAuth(req); if (!auth) return unauthorizedResponse();
  const db = callerClient(req);
  const { data: superadmin, error: roleError } = await db.rpc('is_superadmin', { _user_id: auth.userId });
  if (roleError || superadmin !== true) return forbiddenResponse('Nur Super-Admins dürfen Abgeordnetenbilder hochladen.');
  const body = await boundedJson(req);
  if (!body || typeof body.connectionId !== 'string' || !PORTRAIT_ID.test(body.connectionId)) return badRequestResponse('Ungültige Mandatsverbindung oder zu große Anfrage.');
  const source = portraitSource(body.source);
  const image = decodeImage(body.image, false); const thumbnail = decodeImage(body.thumbnail, true);
  const largeImage = body.largeImage === undefined ? null : decodeImage(body.largeImage, 'large');
  if ((body.largeImage !== undefined && !largeImage) || !source || !image || !thumbnail || (body.expectedVersion !== null && (typeof body.expectedVersion !== 'string' || !PORTRAIT_ID.test(body.expectedVersion)))) return badRequestResponse('Bitte gültige WebP-Ausschnitte und eine gültige Quellenangabe übermitteln.');
  // Authorize the actual catalog connection before any GitHub side effect.
  const { data: mandates, error: mandateError } = await db.from('election_history_mandates').select('id').eq('connection_id', body.connectionId).limit(1);
  if (mandateError || !mandates?.length) return badRequestResponse('Die Mandatsverbindung existiert nicht mehr. Bitte neu laden.');
  const token = Deno.env.get('GITHUB_DEPUTY_PORTRAITS_TOKEN');
  if (!token) return fail(503, 'github_not_configured', 'Der GitHub-Upload ist noch nicht eingerichtet. Das Server-Secret GITHUB_DEPUTY_PORTRAITS_TOKEN fehlt.');
  const api = async (path: string, method = 'GET', payload?: unknown) => fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'landtag-tandem-portraits' },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(15_000),
  });
  const required = async (response: Response) => {
    if (!response.ok) throw new Error(`GitHub API status ${response.status}`);
    return response.json();
  };
  const directory = `public/images/abgeordnete/${body.connectionId}`;
  const metadata: DeputyPortrait = { schemaVersion: 1, connectionId: body.connectionId, version: crypto.randomUUID(),
    image: `portrait-${await digest(image)}.webp`, thumbnail: `thumb-${await digest(thumbnail)}.webp`, source, ...(largeImage ? { largeImage: `large-${await digest(largeImage)}.webp` } : {}), updatedAt: new Date().toISOString() };
  let blobs: { image: string; thumbnail: string; largeImage: string | null; metadata: string } | null = null;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await required(await api(`git/ref/heads/${BRANCH}`));
      const head = ref.object.sha;
      const previousResponse = await api(`contents/${directory}/portrait.json?ref=${head}`);
      let previous: DeputyPortrait | null = null;
      if (previousResponse.status !== 404) {
        const stored = await required(previousResponse);
        const binary = atob(stored.content.replace(/\s/g, ''));
        const candidate = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
        if (!isDeputyPortrait(candidate, body.connectionId)) return fail(409, 'portrait_conflict', 'Die vorhandene Bilddatei hat ein anderes Format. Bitte die Repository-Datei prüfen.');
        previous = candidate;
      }
      if ((previous?.version || null) !== body.expectedVersion) return fail(409, 'portrait_conflict', 'Für diesen Abgeordneten liegt bereits ein neuerer Upload vor. Bitte nach dem Lovable-Deployment neu laden.');
      if (!blobs) {
        const [main, small, large, meta] = await Promise.all([
          api('git/blobs', 'POST', { content: body.image, encoding: 'base64' }).then(required),
          api('git/blobs', 'POST', { content: body.thumbnail, encoding: 'base64' }).then(required),
          largeImage ? api('git/blobs', 'POST', { content: body.largeImage, encoding: 'base64' }).then(required) : Promise.resolve(null),
          api('git/blobs', 'POST', { content: `${JSON.stringify(metadata, null, 2)}\n`, encoding: 'utf-8' }).then(required),
        ]);
        blobs = { image: main.sha, thumbnail: small.sha, largeImage: large?.sha || null, metadata: meta.sha };
      }
      const commit = await required(await api(`git/commits/${head}`));
      const tree: { path: string; mode: string; type: string; sha: string | null }[] = [
        { path: `${directory}/${metadata.image}`, mode: '100644', type: 'blob', sha: blobs.image },
        { path: `${directory}/${metadata.thumbnail}`, mode: '100644', type: 'blob', sha: blobs.thumbnail },
        { path: `${directory}/portrait.json`, mode: '100644', type: 'blob', sha: blobs.metadata },
      ];
      if (metadata.largeImage && blobs.largeImage) tree.push({ path: `${directory}/${metadata.largeImage}`, mode: '100644', type: 'blob', sha: blobs.largeImage });
      if (previous?.largeImage && previous.largeImage !== metadata.largeImage) tree.push({ path: `${directory}/${previous.largeImage}`, mode: '100644', type: 'blob', sha: null });
      // Remove replaced assets from the current tree; Git history remains intact.
      if (previous && previous.image !== metadata.image) tree.push({ path: `${directory}/${previous.image}`, mode: '100644', type: 'blob', sha: null });
      if (previous && previous.thumbnail !== metadata.thumbnail) tree.push({ path: `${directory}/${previous.thumbnail}`, mode: '100644', type: 'blob', sha: null });
      const nextTree = await required(await api('git/trees', 'POST', { base_tree: commit.tree.sha, tree }));
      const nextCommit = await required(await api('git/commits', 'POST', { message: `Update deputy portrait ${body.connectionId}`, tree: nextTree.sha, parents: [head] }));
      const update = await api(`git/refs/heads/${BRANCH}`, 'PATCH', { sha: nextCommit.sha, force: false });
      if (update.ok) return jsonResponse({ metadata, commitSha: nextCommit.sha });
      if (![409, 422].includes(update.status)) await required(update);
      const latest = await required(await api(`git/ref/heads/${BRANCH}`));
      if (latest.object.sha === head) return fail(409, 'github_branch_rules', 'GitHub erlaubt den Commit auf Main nicht. Bitte Schreibberechtigung und Branch-Regeln für den Upload-Zugang prüfen.');
      // Another commit advanced main: rebuild from the new head, without force-push.
    }
    return fail(409, 'repository_busy', 'Main wurde gleichzeitig geändert. Bitte den Upload erneut speichern.');
  } catch {
    return fail(502, 'github_upload_failed', 'GitHub konnte das Bild nicht speichern. Bitte Repository-Berechtigungen, Branch-Regeln und Server-Konfiguration prüfen.');
  }
}));

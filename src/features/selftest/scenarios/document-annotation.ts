import { annotationTaskDefaults, assignedAnnotationThreads } from "@/features/annotations/taskModel";
import { taskZone, stepState } from "@/features/tasks/stafette";
import { canManageAnnotation, canResolveAnnotation } from "@/features/annotations/permissions";
import { annotationMentionToken, annotationMentionIds, annotationDocumentPath, plainAnnotationComment } from "@/features/annotations/mentions";
import { advanceAnnotationHistory, emptyAnnotationHistory, recordAnnotationChange } from "@/features/annotations/annotationHistory";
import { supabase } from '@/integrations/supabase/client';
import { getAnnotationFileKind, toFracPoint, toFracRect, polygonIsValid, isMeaningfulRect, moveAnnotationSelector, moveAnnotationHandle, annotationZoom, annotationBounds, annotationNumbers, annotationThreads, canCloseAnnotationPolygon, annotationPatchMatches, selectionRectsToFrac, pointAnnotationIsValid, isMeaningfulArrow, annotationShortcut, annotationPinAnchor } from '@/features/annotations/annotationModel';
import type { TestScenario } from '../types';

export const documentAnnotationScenario: TestScenario = {
  id: 'document-annotation', title: 'Dokument-Annotation',
  description: 'Dateiregeln, Koordinaten, Polygon, Verschieben und Eckpunkte sowie Speicherung, Antworten und Zugriffsgrenzen.',
  touches: ['documents', 'document_annotations', 'document_annotation_tasks', 'tasks', 'task_assignees'], features: ['documents', 'permissions', 'tasks'],
  checks: ['Dateityp', 'Bruchteil-Koordinaten', 'Polygon-Mindestpunkte', 'Verschieben und Eckpunkte', 'Zoomgrenzen', 'Anlegen, Antworten, Erledigen und Löschen', 'Fremde Autorenschaft und Mandatsgrenzen', 'Serverrollen und aktive RLS/Trigger', 'Erwähnungen mit Thread-Link'],
  limitations: ['Realtime, Scrollen und Benachrichtigungszustellung erfordern zwei interaktive Sitzungen. Die Serverrollenprüfung gilt für das angemeldete Konto; die UI-Regeln decken alle Rollen ab. Fremde Datensätze werden nicht testweise verändert.'],
  steps: [
    { id: 'file-kind', label: 'Unterstützte Dateitypen', kind: 'logic', run: async () => ({
      ok: getAnnotationFileKind('A.PDF') === 'pdf' && getAnnotationFileKind('scan', 'application/pdf') === 'pdf'
        && ['png', 'jpg', 'jpeg', 'webp'].every(ext => getAnnotationFileKind(`a.${ext}`) === 'image')
        && getAnnotationFileKind('a.docx') === null,
      message: 'PDF und unterstützte Bilder werden erkannt; Office-Dateien abgewiesen.',
    }) },
    { id: 'fractions', label: 'Koordinaten normalisieren und begrenzen', kind: 'logic', run: async () => {
      const r = toFracRect({ x: 150, y: 100 }, { x: 50, y: 20 }, 200, 200);
      const p = toFracPoint({ x: -20, y: 500 }, 200, 200);
      return { ok: r.x === .25 && r.y === .1 && r.w === .5 && r.h === .4 && p.x === 0 && p.y === 1
        && isMeaningfulRect(r) && !isMeaningfulRect({ x: 0, y: 0, w: .001, h: .001 }), message: 'Bruchteile bleiben unabhängig vom Zoom; versehentliche Klicks werden erkannt.' };
    } },
    { id: 'polygon', label: 'Polygon benötigt mindestens drei Punkte', kind: 'logic', run: async () => ({
      ok: !polygonIsValid([]) && !polygonIsValid([{ x: 0, y: 0 }, { x: 1, y: 0 }])
        && polygonIsValid([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), message: 'Gemeinsame Polygonregel geprüft.',
    }) },
    { id: 'edit-geometry', label: 'Markierungen verschieben, Eckpunkte anpassen und Zoom begrenzen', kind: 'logic', run: async () => {
      const original = { rects: [{ x: .1, y: .2, w: .3, h: .2 }] };
      const moved = moveAnnotationSelector(original, { x: 2, y: -2 }).rects![0];
      const resized = moveAnnotationHandle(original, { kind: 'rect', index: 0, corner: 2 }, { x: .6, y: .7 }).rects![0];
      const polygon = { points: [{ x: .1, y: .1 }, { x: .5, y: .1 }, { x: .3, y: .5 }] };
      const vertex = moveAnnotationHandle(polygon, { kind: 'point', index: 1 }, { x: 2, y: -.5 }).points!;
      return { ok: Math.abs(moved.x - .7) < 1e-8 && moved.y === 0 && moved.w === .3 && moved.h === .2
        && resized.x === .1 && resized.y === .2 && Math.abs(resized.w - .5) < 1e-8 && Math.abs(resized.h - .5) < 1e-8
        && vertex[1].x === 1 && vertex[1].y === 0 && vertex[0] === polygon.points[0]
        && original.rects[0].x === .1 && polygon.points[1].x === .5
        && annotationZoom(10) === 4 && annotationZoom(.01) === .25 && annotationZoom(1.5) === 1.5,
        message: 'Form und Grenzen bleiben erhalten; Ecken sind unabhängig bearbeitbar; Zoom reicht über 100 Prozent.' };
    } },
    { id: 'annotation-presentation', label: 'Nummern, Filter, Anker und Polygonabschluss', kind: 'logic', run: async () => {
      const rows = [{ id: 'a', parent_id: null, resolved: false }, { id: 'reply', parent_id: 'a', resolved: false }, { id: 'b', parent_id: null, resolved: true }];
      const numbers = annotationNumbers(rows);
      const bounds = annotationBounds({ points: [{ x: .2, y: .3 }, { x: .8, y: .7 }, { x: .4, y: .9 }] });
      const points = [{ x: .1, y: .1 }, { x: .5, y: .1 }, { x: .5, y: .5 }];
      return { ok: numbers.a === 1 && numbers.b === 2 && numbers.reply === undefined
        && annotationThreads(rows, 'open').length === 1 && annotationThreads(rows, 'done')[0]?.id === 'b'
        && annotationThreads(rows, 'all').length === 2 && bounds?.x === .2 && bounds.y === .3
        && Math.abs(bounds.w - .6) < 1e-8 && Math.abs(bounds.h - .6) < 1e-8 && annotationBounds({}) === null
        && canCloseAnnotationPolygon(points, { x: .105, y: .105 }, 1000, 1000)
        && !canCloseAnnotationPolygon(points.slice(0, 2), points[0], 1000, 1000)
        && !canCloseAnnotationPolygon(points, { x: .5, y: .5 }, 1000, 1000),
        message: 'Antworten erhalten keine eigene Markierungsnummer; Filter und Kommentaranker passen zur gespeicherten Geometrie.' };
    } },
    { id: 'edit-history', label: 'Bearbeitungen rückgängig und wiederholen, ohne fremde Änderungen zu überschreiben', kind: 'logic', run: async () => {
      const entry = { id: 'a', before: { content: 'Vorher' }, after: { content: 'Nachher' } };
      let state = recordAnnotationChange(emptyAnnotationHistory(), entry);
      state = advanceAnnotationHistory(state, 'undo');
      const undone = state.undo.length === 0 && state.redo.length === 1;
      state = advanceAnnotationHistory(state, 'redo');
      const redone = state.undo.length === 1 && state.redo.length === 0;
      state = recordAnnotationChange(advanceAnnotationHistory(state, 'undo'), entry);
      const branched = state.redo.length === 0;
      for (let i = 0; i < 60; i++) state = recordAnnotationChange(state, entry);
      return { ok: undone && redone && branched && state.undo.length === 50
        && annotationPatchMatches({ content: 'Nachher', color: 'blue' }, entry.after)
        && !annotationPatchMatches({ content: 'Kollegin hat geändert' }, entry.after)
        && annotationPatchMatches({ target_selector: { rects: [{ x: .1, y: .2, w: .3, h: .4 }] } }, { target_selector: { rects: [{ h: .4, w: .3, y: .2, x: .1 }] } }),
        message: 'Verlauf bleibt auf 50 erfolgreiche Bearbeitungen begrenzt; Konflikte und JSONB-Schlüsselreihenfolge werden korrekt erkannt.' };
    } },
    { id: 'arrow-note-shortcuts', label: 'Pfeile, Notiz-Nadeln und Tastaturbelegung', kind: 'logic', run: async () => {
      const arrow = [{ x: .1, y: .2 }, { x: .7, y: .6 }], note = [{ x: .5, y: .5 }];
      const moved = moveAnnotationSelector({ points: note }, { x: 2, y: -2 }).points!;
      const endpoint = moveAnnotationHandle({ points: arrow }, { kind: 'point', index: 1 }, { x: .9, y: .8 }).points!;
      return { ok: pointAnnotationIsValid('arrow', arrow) && pointAnnotationIsValid('note', note)
        && !pointAnnotationIsValid('arrow', note) && !pointAnnotationIsValid('note', arrow)
        && !pointAnnotationIsValid('arrow', [note[0], note[0]]) && !pointAnnotationIsValid('note', [{ x: -1, y: .5 }])
        && isMeaningfulArrow(arrow, 100, 100) && !isMeaningfulArrow([{ x: 0, y: 0 }, { x: .001, y: 0 }], 100, 100)
        && moved[0].x === 1 && moved[0].y === 0 && endpoint[0] === arrow[0] && endpoint[1].x === .9
        && ['yellow', 'green', 'red', 'blue'].every((color, index) => {
          const action = annotationShortcut(String(index + 1), 'pdf'); return action?.action === 'color' && action.color === color;
        }) && [['H', 'highlight'], ['R', 'rect'], ['P', 'polygon']].every(([key, tool]) => {
          const action = annotationShortcut(key, 'pdf'); return action?.action === 'tool' && action.tool === tool;
        }) && annotationShortcut('Delete', 'pdf')?.action === 'delete' && annotationShortcut('Escape', 'image')?.action === 'cancel'
        && annotationShortcut('H', 'image') === null && annotationShortcut('5', 'pdf') === null,
        message: 'Pfeile besitzen zwei getrennte Endpunkte, Notizen einen Anker; Farbkürzel und Werkzeugkürzel sind eindeutig.' };
    } },
    { id: 'arrow-pin-anchor', label: 'Pfeilnummer bleibt bei jeder Richtung am Startpunkt', kind: 'logic', run: async () => {
      const tail = { x: .8, y: .7 }, tip = { x: .1, y: .2 };
      const anchor = annotationPinAnchor('arrow', { points: [tail, tip] });
      const reverse = annotationPinAnchor('arrow', { points: [tip, tail] });
      return { ok: anchor?.x === tail.x && anchor.y === tail.y && reverse?.x === tip.x && reverse.y === tip.y
        && annotationPinAnchor('note', { points: [tail] }) === tail && annotationPinAnchor('arrow', {}) === null,
        message: 'Die Nummer sitzt am Pfeilanfang; die Spitze bleibt frei, auch bei nach links oder oben gerichteten Pfeilen.' };
    } },
    { id: 'zoom-invariance', label: 'Zoom- und Koordinatentreue bei 25 bis 400 Prozent', kind: 'logic', run: async () => {
      const checks = [.25, .5, 1, 1.75, 2, 4].map(zoom => {
        const width = 1200 * zoom, height = 800 * zoom;
        const point = toFracPoint({ x: .35 * width, y: .7 * height }, width, height);
        const rect = toFracRect({ x: .2 * width, y: .3 * height }, { x: .6 * width, y: .8 * height }, width, height);
        const selection = selectionRectsToFrac([{ left: 10 + .2 * width, top: 20 + .3 * height, width: .4 * width, height: .05 * height }], { left: 10, top: 20, width, height });
        const near = (a: number, b: number) => Math.abs(a - b) < 1e-8;
        return near(point.x, .35) && near(point.y, .7) && near(rect.x, .2) && near(rect.y, .3) && near(rect.w, .4) && near(rect.h, .5)
          && selection.length === 1 && near(selection[0].x, .2) && near(selection[0].y, .3) && near(selection[0].w, .4) && near(selection[0].h, .05);
      });
      return { ok: checks.every(Boolean), message: 'Punkte, Bereiche und PDF-Textmarkierungen behalten über alle Zoomstufen dieselben Bruchteile.' };
    } },
    { id: 'permission-matrix', label: 'Autor, Mitarbeitende, Leitung und fehlende Mitgliedschaft unterscheiden', kind: 'logic', run: async () => {
      const staff = { userId: 'staff', tenantMember: true, roles: ['mitarbeiter'] };
      return { ok: canManageAnnotation('staff', staff) && !canManageAnnotation('other', staff) && canResolveAnnotation(staff)
        && ['abgeordneter', 'bueroleitung'].every(role => canManageAnnotation('other', { ...staff, roles: [role] }))
        && !canManageAnnotation('staff', { ...staff, tenantMember: false })
        && !canManageAnnotation('other', { ...staff, tenantMember: false, roles: ['bueroleitung'] })
        && !canResolveAnnotation({ ...staff, tenantMember: false }) && !canResolveAnnotation({ ...staff, userId: undefined }),
        message: 'Nur Autor oder Leitung dürfen ändern/löschen; aktive Mitglieder dürfen erledigt setzen. Ohne Mitgliedschaft besteht kein Zugriff.' };
    } },
    { id: 'mention-link', label: 'Erwähnungen eindeutig auflösen und direkt zum Thread verlinken', kind: 'logic', run: async () => {
      const id = '11111111-aaaa-4444-8888-111111111111';
      const token = annotationMentionToken('Änne [Büro]', id);
      const ids = annotationMentionIds(`${token} ${token} @NichtAusgewählt @[Ungültig](keine-uuid)`);
      const params = new URL(annotationDocumentPath('doc-id', 'reply-id'), 'https://selftest.invalid').searchParams;
      return { ok: token === `@[Änne Büro](${id})` && ids.length === 1 && ids[0] === id
        && plainAnnotationComment(token) === '@Änne Büro' && params.get('annotate') === 'doc-id' && params.get('annotation') === 'reply-id',
        message: 'Eine bestätigte Person wird per UUID erwähnt; doppelte Erwähnungen bleiben eindeutig und der Link enthält den konkreten Thread.' };
    } },
    { id: 'annotation-task-rules', label: 'Zuständigkeit, Mein-Filter und Stafette-Vorgaben', kind: 'logic', run: async () => {
      const rows = [
        { id: 'mine', parent_id: null, resolved: false, assigned_to: 'me' },
        { id: 'other', parent_id: null, resolved: false, assigned_to: 'other' },
        { id: 'done', parent_id: null, resolved: true, assigned_to: 'me' },
        { id: 'reply', parent_id: 'mine', resolved: false, assigned_to: null },
      ];
      const defaults = annotationTaskDefaults({ id: 'note', document_id: 'document', assigned_to: 'other', page_number: 12, content: 'Rückfrage formulieren' }, 'Drucksache', 'me');
      const fallback = annotationTaskDefaults({ id: 'note', document_id: 'document', assigned_to: null, page_number: null, content: '' }, 'Anlage', 'me');
      return { ok: assignedAnnotationThreads(rows, 'open', 'me', true).length === 1
        && assignedAnnotationThreads(rows, 'all', 'me', true).length === 2
        && assignedAnnotationThreads(rows, 'all', undefined, true).length === 0
        && assignedAnnotationThreads(rows, 'open', 'me', false).length === 2
        && defaults.assigneeId === 'other' && defaults.title.includes('Seite 12') && defaults.title.includes('Rückfrage')
        && defaults.documentPath.includes('annotate=document') && defaults.documentPath.includes('annotation=note')
        && fallback.assigneeId === 'me' && fallback.title.length > 0
        && taskZone({ ball_owner: 'office', ball_assignee_id: defaults.assigneeId, next_action: defaults.nextAction }, 'other') === 'mine'
        && stepState({ next_action: defaults.nextAction }) === 'set',
        message: 'Nur eigene Hauptanmerkungen werden gefiltert; eine Aufgabe übernimmt die Zuständigkeit und eine konkrete nächste Aktion.' };
    } },
    { id: 'annotation-task-storage', label: 'Zuweisung und eindeutige Stafette-Aufgabe atomar speichern', kind: 'workflow', run: async ctx => {
      const result = await supabase.rpc('document_annotation_task_selftest', { _tenant: ctx.tenantId });
      const report = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data : null;
      return { ok: !result.error && report?.ok === true, message: result.error?.message ?? String(report?.message ?? 'Aufgabenprüfung fehlgeschlagen'), details: report?.checks };
    } },
    { id: 'schema', label: 'Antwortspalte im aktiven Backend vorhanden', critical: true, run: async ctx => {
      const result = await supabase.from('document_annotations').select('id,parent_id').eq('tenant_id', ctx.tenantId).limit(0);
      return { ok: !result.error, message: result.error?.message ?? 'parent_id ist im aktiven Backend verfügbar.' };
    } },
    { id: 'server-mentions', label: 'Client und Datenbank erkennen dieselben erwähnten Personen', run: async () => {
      const id = '11111111-aaaa-4444-8888-111111111111';
      const content = `${annotationMentionToken('Büro', id)} @[Büro](${id.toUpperCase()}) @Freitext @[Ungültig](keine-uuid)`;
      const result = await supabase.rpc('document_annotation_mention_ids', { _content: content });
      return { ok: !result.error && JSON.stringify([...(result.data ?? [])].sort()) === JSON.stringify(annotationMentionIds(content).sort()),
        message: result.error?.message ?? 'Server und UI lösen bestätigte Erwähnungen identisch auf; es werden keine Benachrichtigungen versendet.' };
    } },
    { id: 'server-permissions', label: 'Serverrollen, Löschpolicy und aktive Schutz-Trigger prüfen', run: async ctx => {
      const result = await supabase.rpc('document_annotations_permissions_selftest', { _tenant: ctx.tenantId });
      const report = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data : null;
      return { ok: !result.error && report?.ok === true, message: result.error?.message ?? String(report?.message ?? 'Serverprüfung fehlgeschlagen'), details: report?.checks };
    } },
    { id: 'persistence', label: 'Anlegen → Antworten → Erledigen → Löschen; Rechte prüfen', run: async ctx => {
      const doc = await supabase.from('documents').insert({ tenant_id: ctx.tenantId, user_id: ctx.userId,
        title: `[SELFTEST] Annotation ${ctx.runId}`, file_name: 'selftest.pdf', file_path: `selftest/${ctx.runId}.pdf` }).select('id').single();
      if (doc.error || !doc.data) return { ok: false, message: doc.error?.message ?? 'Dokument fehlt' };
      ctx.trackRecord({ table: 'documents', id: doc.data.id });
      const payload = { tenant_id: ctx.tenantId, document_id: doc.data.id, created_by: ctx.userId,
        file_kind: 'pdf', annotation_type: 'rect', page_number: 1, target_selector: { rects: [{ x: .1, y: .2, w: .3, h: .2 }] }, content: '[SELFTEST] Kommentar' };
      const created = await supabase.from('document_annotations').insert(payload).select('*').single();
      if (created.error || !created.data) return { ok: false, message: created.error?.message ?? 'Anmerkung fehlt' };
      ctx.trackRecord({ table: 'document_annotations', id: created.data.id });
      const checks: Record<string, boolean> = { saved: created.data.content === payload.content && !created.data.resolved };
      const repositioned = await supabase.from('document_annotations').update({ target_selector: { rects: [{ x: .2, y: .3, w: .3, h: .2 }] } })
        .eq('id', created.data.id).select('target_selector').single();
      const stored = repositioned.data?.target_selector as { rects?: { x: number; y: number; w: number; h: number }[] } | undefined;
      const rect = stored?.rects?.[0];
      checks.repositioned = !repositioned.error && rect?.x === .2 && rect.y === .3 && rect.w === .3 && rect.h === .2;
      const reply = await supabase.from('document_annotations').insert({ ...payload, parent_id: created.data.id, content: '[SELFTEST] Antwort' }).select('id, parent_id').single();
      if (reply.data) ctx.trackRecord({ table: 'document_annotations', id: reply.data.id });
      checks.reply = !reply.error && reply.data?.parent_id === created.data.id;
      if (reply.data) {
        const nested = await supabase.from('document_annotations').insert({ ...payload, parent_id: reply.data.id }).select('id');
        for (const row of nested.data ?? []) ctx.trackRecord({ table: 'document_annotations', id: row.id });
        checks.noNestedReplies = !!nested.error && !nested.data?.length;
        const moved = await supabase.from('document_annotations').update({ parent_id: null }).eq('id', reply.data.id).select('id');
        checks.immutableParent = !!moved.error;
      }
      const otherDoc = await supabase.from('documents').insert({ tenant_id: ctx.tenantId, user_id: ctx.userId,
        title: `[SELFTEST] Fremdes Thread-Ziel ${ctx.runId}`, file_name: 'other.pdf', file_path: `selftest/${ctx.runId}-other.pdf` }).select('id').single();
      checks.otherDocumentCreated = !otherDoc.error && !!otherDoc.data;
      if (otherDoc.data) {
        ctx.trackRecord({ table: 'documents', id: otherDoc.data.id });
        const crossDocument = await supabase.from('document_annotations').insert({ ...payload, document_id: otherDoc.data.id, parent_id: created.data.id }).select('id');
        for (const row of crossDocument.data ?? []) ctx.trackRecord({ table: 'document_annotations', id: row.id });
        checks.crossDocumentDenied = !!crossDocument.error && !crossDocument.data?.length;
      }
      const loadedReplies = await supabase.from('document_annotations').select('id,parent_id,content').eq('document_id', doc.data.id).eq('parent_id', created.data.id);
      checks.threadReadback = !loadedReplies.error && loadedReplies.data?.length === 1 && loadedReplies.data[0].id === reply.data?.id && loadedReplies.data[0].content === '[SELFTEST] Antwort';
      const forged = await supabase.from('document_annotations').insert({ ...payload, created_by: crypto.randomUUID() }).select('id');
      for (const row of forged.data ?? []) ctx.trackRecord({ table: 'document_annotations', id: row.id });
      checks.authorGuard = !!forged.error && !forged.data?.length;
      const foreign = await supabase.from('document_annotations').insert({ ...payload, tenant_id: crypto.randomUUID() }).select('id');
      for (const row of foreign.data ?? []) ctx.trackRecord({ table: 'document_annotations', id: row.id });
      checks.tenantGuard = !!foreign.error && !foreign.data?.length;
      for (const shape of [
        { type: 'arrow', points: [{ x: .1, y: .2 }, { x: .7, y: .6 }], moved: [{ x: .2, y: .3 }, { x: .8, y: .7 }] },
        { type: 'note', points: [{ x: .5, y: .5 }], moved: [{ x: .6, y: .7 }] },
      ]) {
        const saved = await supabase.from('document_annotations').insert({ ...payload, annotation_type: shape.type, target_selector: { points: shape.points } }).select('id, annotation_type, target_selector').single();
        checks[`${shape.type}Saved`] = !saved.error && saved.data?.annotation_type === shape.type;
        if (saved.data) {
          ctx.trackRecord({ table: 'document_annotations', id: saved.data.id });
          const moved = await supabase.from('document_annotations').update({ target_selector: { points: shape.moved } }).eq('id', saved.data.id).select('target_selector').single();
          checks[`${shape.type}Moved`] = !moved.error && annotationPatchMatches(moved.data ?? {}, { target_selector: { points: shape.moved } });
          const removedShape = await supabase.from('document_annotations').delete().eq('id', saved.data.id).select('id').single();
          checks[`${shape.type}Deleted`] = !removedShape.error && removedShape.data?.id === saved.data.id;
        }
        const invalid = await supabase.from('document_annotations').insert({ ...payload, annotation_type: shape.type, target_selector: { points: [] } }).select('id');
        for (const row of invalid.data ?? []) ctx.trackRecord({ table: 'document_annotations', id: row.id });
        checks[`${shape.type}Guard`] = !!invalid.error && !invalid.data?.length;
      }
      const updated = await supabase.from('document_annotations').update({ resolved: true }).eq('id', created.data.id).select('resolved').single();
      checks.resolved = !updated.error && updated.data?.resolved === true;
      const removed = await supabase.from('document_annotations').delete().eq('id', created.data.id).select('id').single();
      const remaining = await supabase.from('document_annotations').select('id').eq('document_id', doc.data.id);
      checks.deleted = !removed.error && removed.data?.id === created.data.id && !remaining.error && remaining.data?.length === 0;
      return { ok: Object.values(checks).every(Boolean), message: Object.values(checks).every(Boolean) ? 'Speicherablauf und Rechte geprüft.' : 'Speicherablauf oder Rechte fehlgeschlagen.', details: checks };
    } },
  ],
};

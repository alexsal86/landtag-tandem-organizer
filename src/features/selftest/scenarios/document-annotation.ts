import { advanceAnnotationHistory, emptyAnnotationHistory, recordAnnotationChange } from "@/features/annotations/annotationHistory";
import { supabase } from '@/integrations/supabase/client';
import { getAnnotationFileKind, toFracPoint, toFracRect, polygonIsValid, isMeaningfulRect, moveAnnotationSelector, moveAnnotationHandle, annotationZoom, annotationBounds, annotationNumbers, annotationThreads, canCloseAnnotationPolygon, annotationPatchMatches, pointAnnotationIsValid, isMeaningfulArrow, annotationShortcut } from '@/features/annotations/annotationModel';
import type { TestScenario } from '../types';

export const documentAnnotationScenario: TestScenario = {
  id: 'document-annotation', title: 'Dokument-Annotation',
  description: 'Dateiregeln, Koordinaten, Polygon, Verschieben und Eckpunkte sowie Speicherung, Antworten und Zugriffsgrenzen.',
  touches: ['documents', 'document_annotations'], features: ['documents', 'permissions'],
  checks: ['Dateityp', 'Bruchteil-Koordinaten', 'Polygon-Mindestpunkte', 'Verschieben und Eckpunkte', 'Zoomgrenzen', 'Anlegen, Antworten, Erledigen und Löschen', 'Fremde Autorenschaft und Mandatsgrenzen'],
  limitations: ['Realtime, Scrollen und Benachrichtigungszustellung erfordern eine interaktive Sitzung mit zwei Personen. Rollenwechsel und Bearbeiten fremder Kommentare werden hier nicht simuliert.'],
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

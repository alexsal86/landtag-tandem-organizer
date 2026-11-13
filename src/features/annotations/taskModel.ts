import { annotationThreads, type AnnotationFilter } from './annotationModel';
import { annotationDocumentPath, plainAnnotationComment } from './mentions';
import type { DocumentAnnotation } from './types';

export function assignedAnnotationThreads<T extends { parent_id: string | null; resolved: boolean; assigned_to: string | null }>(
  annotations: T[], filter: AnnotationFilter, userId: string | undefined, onlyMine: boolean,
): T[] {
  return annotationThreads(annotations, filter).filter(a => !onlyMine || (!!userId && a.assigned_to === userId));
}

export function annotationTaskDefaults(annotation: Pick<DocumentAnnotation, 'content' | 'page_number' | 'assigned_to' | 'document_id' | 'id'>, documentTitle: string, userId: string) {
  const context = `${documentTitle}${annotation.page_number ? ` · Seite ${annotation.page_number}` : ''}`;
  const comment = plainAnnotationComment(annotation.content).trim().replace(/\s+/g, ' ');
  const title = `${comment || 'Anmerkung klären'} – ${context}`.slice(0, 240);
  return { title, assigneeId: annotation.assigned_to ?? userId, nextAction: title,
    documentPath: annotationDocumentPath(annotation.document_id, annotation.id) };
}


export function annotationTaskStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'todo': return 'Offen';
    case 'in-progress': return 'In Bearbeitung';
    case 'completed': return 'Abgeschlossen';
    default: return 'Status nicht verfügbar';
  }
}

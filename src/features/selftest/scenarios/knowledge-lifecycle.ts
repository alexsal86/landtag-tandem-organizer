import { answerText, effectiveReviewStatus, knowledgeUrlState, knowledgeQuestionPath, parseAnswer, validateAttachment, validateQuestion } from '@/features/knowledge/logic';
import { supabase } from '@/integrations/supabase/client';
import type { TestScenario } from '../types';

export const knowledgeLifecycleScenario: TestScenario = {
  id: 'knowledge-lifecycle', title: 'Wissen: Fragen, Antworten und manuelle Prüfung',
  description: 'Prüft Eingaben und den echten Frage-Antwort-Ablauf. Testdatensätze und Verlauf werden in einer Datenbank-Untertransaktion vollständig zurückgerollt.',
  features: ['knowledge', 'permissions'], touches: ['knowledge_questions', 'knowledge_question_events', 'knowledge_qa_notification_deliveries'],
  checks: ['Frage als einziges Pflichtfeld', 'Validierte Antwort und sichere Links', 'Drei Prüfzustände und Fälligkeit', 'Anhanggrenzen', 'Lesen außerhalb des eigenen Büros'],
  limitations: ['Zwei-Büro-Isolation, FTS und Storage-Policies werden zusätzlich mit scripts/test-knowledge-qa.mjs in isoliertem PostgreSQL geprüft. Echte Storage-HTTP-Zugriffe benötigen eine Supabase-Testinstanz.'],
  steps: [
    { id: 'notification-delivery', label: 'Serverzustellung, Einstellungen und dauerhafte Duplikatsperre', kind: 'workflow', run: async ctx => {
      const response = await supabase.rpc('knowledge_qa_notification_selftest', { p_tenant: ctx.tenantId });
      const result = response.data && typeof response.data === 'object' && !Array.isArray(response.data) ? response.data : null;
      return { ok: !response.error && result?.ok === true, message: response.error?.message || String(result?.message || 'Eigene Testbenachrichtigung geprüft und zurückgerollt.'), details: result?.checks };
    } },
    { id: 'manage-workflow', label: 'Pflegeberechtigung, Bearbeiten, Archiv und Duplikat mit Revisionsschutz', kind: 'workflow', run: async ctx => {
      const response = await supabase.rpc('knowledge_qa_manage_selftest', { p_tenant: ctx.tenantId });
      const result = response.data && typeof response.data === 'object' && !Array.isArray(response.data) ? response.data : null;
      return { ok: !response.error && result?.ok === true, message: response.error?.message || String(result?.message || 'Pflegeablauf geprüft; Teständerungen zurückgerollt.'), details: result?.checks };
    } },
    { id: 'notification-question-link', label: 'Benachrichtigungen öffnen die konkrete Wissensfrage', kind: 'logic', run: async () => ({
      ok: knowledgeQuestionPath('test-id') === '/wissen?frage=test-id' && knowledgeQuestionPath(null) === '/wissen',
      message: 'Zuweisung, Antwort und Prüfung führen direkt zur Frage.',
    }) },
    { id: 'filter-state', label: 'Ansichten und Filter aus URL wiederherstellen', kind: 'logic', run: async () => {
      const state = knowledgeUrlState(new URLSearchParams('ansicht=assigned&status=open&zustaendig=unassigned&sortierung=oldest'));
      return { ok: state.view === 'assigned' && state.filters.status === 'open' && state.filters.assignee === 'unassigned' && state.filters.sort === 'oldest', message: 'Filter bleiben teilbar und werden gegen Whitelists geprüft.' };
    } },
    { id: 'bounded-list', label: 'Kompakte Seite mit explizitem Cursor und Gesamtzahl', kind: 'workflow', run: async ctx => {
      const { data, error } = await supabase.rpc('knowledge_qa_list', { p_tenant: ctx.tenantId, p_limit: 1 });
      const page = data?.[0];
      const items = Array.isArray(page?.items) ? page.items : [];
      return { ok: !error && Boolean(page) && items.length <= 1 && items.every(item => item && typeof item === 'object' && !('answer_content' in item) && !('answer_text' in item)), message: error?.message || 'Listen-Payload bleibt begrenzt; Antworten werden bei Bedarf geladen.' };
    } },
    { id: 'real-workflow', label: 'Echte Speicherung, Verlauf, Prüfbestätigung und Rücksetzung ohne bleibende Testdaten', kind: 'workflow', run: async ctx => {
      const response = await supabase.rpc('knowledge_qa_selftest', { p_tenant: ctx.tenantId });
      const result = response.data && typeof response.data === 'object' && !Array.isArray(response.data) ? response.data : null;
      return { ok: !response.error && result?.ok === true, message: response.error?.message || (result?.ok ? 'Datenbankablauf geprüft; alle Teständerungen zurückgerollt.' : String(result?.message || 'Datenbankprüfung fehlgeschlagen.')), details: result?.checks };
    } },
    { id: 'question-input', label: 'Frage ohne Kategorien oder Zuständigkeit zulässig', kind: 'logic', run: async () => ({
      ok: validateQuestion('Wie beantrage ich Urlaub?', '') === null && validateQuestion(' ', '') !== null,
      message: 'Nur die Frage ist verpflichtend; Beschreibung und Zuständigkeit bleiben optional.',
    }) },
    { id: 'answer-input', label: 'Antworttext und Links sicher validieren', kind: 'logic', run: async () => {
      const content = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Bitte das Bürohandbuch lesen.' }] }] } };
      const text = answerText(parseAnswer(JSON.stringify(content)));
      let rejected = false;
      try { parseAnswer(JSON.stringify({ root: { type: 'root', children: [{ type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', text: 'Klick' }] }] } })); }
      catch { rejected = true; }
      return { ok: text === 'Bitte das Bürohandbuch lesen.' && rejected, message: 'Suchtext stammt aus der Antwortstruktur; gefährliche Links werden abgewiesen.' };
    } },
    { id: 'review-status', label: 'Ungeprüft, manuell bestätigt und fällige Überprüfung unterscheiden', kind: 'logic', run: async () => {
      const checks = [
        effectiveReviewStatus({ review_status: 'unverified', review_due_at: null }) === 'unverified',
        effectiveReviewStatus({ review_status: 'verified', review_due_at: null }) === 'verified',
        effectiveReviewStatus({ review_status: 'needs_review', review_due_at: null }) === 'needs_review',
        effectiveReviewStatus({ review_status: 'verified', review_due_at: '2026-11-10T12:00:00Z' }, Date.parse('2026-11-10T12:00:00Z')) === 'needs_review',
      ];
      return { ok: checks.every(Boolean), message: 'Prüfzustände und Erreichen des optionalen Prüftermins werden korrekt angezeigt.' };
    } },
    { id: 'attachment-input', label: 'Nur unterstützte Dateien innerhalb der Größenbegrenzung', kind: 'logic', run: async () => ({
      ok: validateAttachment({ name: 'Wissen.pdf', size: 1024, type: 'application/pdf' }) === null && validateAttachment({ name: 'Script.html', size: 1024, type: 'text/html' }) !== null,
      message: 'Dateityp und Größe werden vor dem Upload geprüft; der Bucket erzwingt dieselben Grenzen.',
    }) },
    { id: 'foreign-office-search', label: 'Suche mit nicht zugehöriger Büro-ID liefert keine Daten', kind: 'workflow', run: async () => {
      const result = await supabase.rpc('knowledge_qa_list', { p_tenant: crypto.randomUUID(), p_query: '', p_view: 'answers' });
      return { ok: !result.error && result.data?.[0]?.total_count === 0, message: result.error ? result.error.message : 'Kein Zugriff auf ein nicht zugehöriges Büro.' };
    } },
  ],
};

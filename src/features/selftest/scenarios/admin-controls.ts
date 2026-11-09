import { supabase } from '@/integrations/supabase/client';
import { collectAuditCsv } from '@/components/administration/utils/auditExport';
import { feedUrl, publicAddress } from '../../../../supabase/functions/_shared/feed-fetch';
import { MODULE_ROUTES } from '@/lib/tenant-modules';
import type { TestScenario } from '../types';

export const adminControlsScenario: TestScenario = {
  id: 'admin-controls', title: 'Adminregeln: Feldschutz, Aktionen, Export, Rücknahme und Feeds',
  description: 'Prüft serverseitige Regeln mit der aktuellen Rolle und reine Export-/Feedregeln ohne externe Aufrufe.',
  features: ['permissions', 'contacts', 'audit'], touches: [],
  checks: ['Export über 1000 Einträge ohne CSV-Formeln', 'Private Feedziele abgewiesen', 'Beide Feldlesemodi im aktuellen Büro', 'Fremde Aktion und ungültige Rücknahme abgewiesen'],
  limitations: ['Die vollständige Rollenmatrix, echte Rücknahmen und Redirect-/DNS-Grenzfälle laufen im separaten PostgreSQL-/Transporttest.', 'Kein Zugriff auf Produktivfeeds und keine Änderung der Büroberechtigungen.'],
  steps: [
    { id: 'feed-rules', label: 'Feedtest sperrt lokale Ziele, Zugangsdaten und Sonderports', kind: 'logic', run: async () => {
      for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fc00::1']) if (publicAddress(ip)) return { ok: false, message: `Private Adresse zugelassen: ${ip}` };
      for (const url of ['file:///etc/passwd', 'http://localhost', 'https://user:password@example.org', 'https://example.org:8080']) {
        try { feedUrl(url); return { ok: false, message: 'Unsichere Feed-URL zugelassen.' }; } catch { /* expected */ }
      }
      return { ok: publicAddress('8.8.8.8'), message: 'Öffentliche Adressen erlaubt, interne Ziele gesperrt.' };
    } },
    { id: 'full-export', label: 'Gesamtexport paginiert und schützt vor Formelauswertung', kind: 'logic', run: async () => {
      let offset = 0;
      const blob = await collectAuditCsv(async () => { const start = offset; offset += 500; return { asOf: 'snapshot', logs: Array.from({length: Math.max(0, Math.min(500, 1101-start))}, (_, i) => ({ id: String(start+i), created_at: '2026-11-09T00:00:00Z', ip_address: null, payload: { action: '=FORMULA' } })) }; }, new AbortController().signal, () => {});
      const csv = await blob.text();
      return { ok: offset === 1500 && csv.split('Zeitstempel').length === 2 && csv.includes("'=FORMULA"), message: '1101 Einträge, ein Header, escaped CSV-Formeln.' };
    } },
    { id: 'module-routes', label: 'Direktlinks der Module sind dem jeweiligen Schalter zugeordnet', kind: 'logic', run: async () => ({ ok: MODULE_ROUTES.letters === 'module.letters' && MODULE_ROUTES.casefiles === 'module.casefiles' && MODULE_ROUTES.time === 'module.timetracking', message: 'Modulrouten besitzen eine zentrale Zuordnung.' }) },
    { id: 'field-modes', label: 'Leseregeln liefern erlauben, Feld ausblenden oder Datensatz sperren', kind: 'workflow', run: async ctx => {
      const rules = await Promise.all([['contacts','email'],['letters','content']].map(([table,column]) => supabase.rpc('field_read_rule', { _tenant: ctx.tenantId, _table: table, _column: column })));
      return { ok: rules.every(rule => !rule.error && ['allow','mask','record'].includes(rule.data ?? '')), message: 'Datenbank liefert die rollenspezifischen Feldmodi.', details: rules.map(rule => ({ rule: rule.data, error: rule.error })) };
    } },
    { id: 'foreign-action', label: 'Aktionsprüfung kann nicht für eine fremde Identität aufgerufen werden', kind: 'workflow', run: async ctx => {
      const result = await supabase.rpc('is_tenant_action_allowed', { _tenant_id: ctx.tenantId, _user_id: crypto.randomUUID(), _action: 'contact.delete' });
      return { ok: !result.error && result.data === false, message: 'Fremde Identität erhält keine Aktionsfreigabe.', details: result.error };
    } },
    { id: 'invalid-bulk', label: 'Leere Sammelaktion und unbekannte Rücknahme verändern keine Kontakte', kind: 'workflow', run: async ctx => {
      const batch = await supabase.rpc('bulk_update_contact_fields', { _tenant_id: ctx.tenantId, _ids: [], _operation: 'tags_add', _value: [] });
      const undo = await supabase.rpc('undo_contact_bulk_action', { _audit_id: crypto.randomUUID() });
      return { ok: batch.error?.code === '22023' && undo.error?.code === '42501', message: 'Ungültige Sammelanfrage und nicht autorisierte Rücknahme abgewiesen.', details: { batch: batch.error, undo: undo.error } };
    } },
  ],
};

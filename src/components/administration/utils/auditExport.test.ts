// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { collectAuditCsv, type ExportLog } from './auditExport';
const logs: ExportLog[] = Array.from({length: 1101}, (_, i) => ({ id: String(i), created_at: `time-${i}`, ip_address: null, payload: { action: '=FORMULA', index: i } }));
it('exports more than 1000 entries with one header and escaped formulas', async () => {
  const read = vi.fn(async (cursor) => { const start = cursor.beforeId ? Number(cursor.beforeId)+1 : 0; return { asOf: 'snapshot', logs: logs.slice(start, start+500) }; });
  const progress = vi.fn();
  const csv = await (await collectAuditCsv(read, new AbortController().signal, progress)).text();
  expect(read).toHaveBeenCalledTimes(3); expect(read.mock.calls[1][0]).toEqual({ asOf: 'snapshot', beforeCreated: 'time-499', beforeId: '499' });
  expect(csv.split('Zeitstempel')).toHaveLength(2); expect(csv).toContain("'=FORMULA"); expect(progress).toHaveBeenLastCalledWith(1101);
});
it('does not return a partial download after cancellation', async () => {
  const controller = new AbortController();
  await expect(collectAuditCsv(async () => { controller.abort(); return { asOf: 'snapshot', logs }; }, controller.signal, () => {})).rejects.toThrow();
});
it('rejects a stuck cursor instead of looping forever', async () => {
  await expect(collectAuditCsv(async () => ({ asOf: 'snapshot', logs: logs.slice(0,500) }), new AbortController().signal, () => {})).rejects.toThrow('Cursor');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRpcTypeReport, renderReport } from '../check-supabase-rpc-types.mjs';

function fixture(t, { functions = [], sources = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'supabase-rpc-types-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, source) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  const entries = functions.map(name => `${name}: { Args: {}; Returns: string }`).join('; ');
  write(
    'src/integrations/supabase/types.ts',
    `export type Database = { public: { Tables: {}; Functions: { ${entries} }; Enums: {} } }`,
  );
  for (const [path, source] of Object.entries(sources)) write(path, source);
  return root;
}

test('meldet clientseitig aufgerufene RPCs ohne Typ-Eintrag', t => {
  const report = collectRpcTypeReport(
    fixture(t, {
      functions: ['present_rpc'],
      sources: {
        'src/features/a.ts': `
          supabase.rpc("present_rpc");
          supabase.rpc("missing_rpc", { p_id: "1" });
          // supabase.rpc("comment_only")
          const text = "supabase.rpc('in_a_string')";
        `,
      },
    }),
  );
  assert.deepEqual(report.missing, ['missing_rpc']);
  assert.equal(report.calls.length, 2);
  assert.equal(report.unresolved.length, 0);
  assert.match(renderReport(report), /missing_rpc \(src\/features\/a\.ts:3\)/);
});

test('prueft nur den Functions-Block und akzeptiert Konstanten sowie Ternaere', t => {
  const report = collectRpcTypeReport(
    fixture(t, {
      functions: ['const_rpc', 'left_rpc', 'right_rpc'],
      sources: {
        'src/features/b.tsx': `
          const CONST_RPC = "const_rpc";
          export const load = (readOnly: boolean) => {
            supabase.rpc(CONST_RPC, {});
            supabase.rpc(readOnly ? "left_rpc" : "right_rpc", {});
          };
        `,
      },
    }),
  );
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.referenced, ['const_rpc', 'left_rpc', 'right_rpc']);
  assert.equal(report.calls.length, 3);
  assert.match(renderReport(report), /3 RPC-Namen aus 3 Aufrufen/);
});

test('dynamische Namen gelten als ungeprueft statt als fehlend', t => {
  const report = collectRpcTypeReport(
    fixture(t, {
      functions: [],
      sources: {
        'src/features/c.ts': `
          supabase.rpc(request.name, request.args);
          supabase.rpc(nameFromParameter(), {});
          supabase.rpc();
        `,
      },
    }),
  );
  assert.deepEqual(report.missing, []);
  assert.equal(report.unresolved.length, 3);
  assert.match(renderReport(report), /3 Aufruf\(e\) mit dynamischem Namen bleiben ungeprüft/);
});

test('respektiert verschachtelte und mehrzeilige Aufrufe', t => {
  const report = collectRpcTypeReport(
    fixture(t, {
      functions: ['nested_rpc'],
      sources: {
        'src/features/d.ts': `
          await supabase
            .rpc(
              "nested_rpc",
              { p_tenant_id: "t" },
            )
            .abortSignal(signal);
        `,
      },
    }),
  );
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.calls, [{ name: 'nested_rpc', file: 'src/features/d.ts', line: 2 }]);
});

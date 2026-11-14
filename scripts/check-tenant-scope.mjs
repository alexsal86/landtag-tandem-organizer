import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const registrySource = readFileSync("src/integrations/supabase/tenantScopedTables.ts", "utf8");
const names = registrySource.match(/const TENANT_SCOPED_TABLE_NAMES = `([\s\S]*?)`;/)?.[1]
  .trim().split(/\s+/) ?? [];
const registry = new Set(names);
const exempt = new Set(["user_tenant_memberships"]);

function tenantRelations(section, nextSection) {
  const start = types.indexOf(`    ${section}: {`);
  const end = types.indexOf(`    ${nextSection}: {`, start);
  if (start < 0 || end < 0) throw new Error(`Schema section missing: ${section}`);
  const block = types.slice(start, end);
  const relation = /^      ([A-Za-z0-9_]+): \{\n        Row: \{/gm;
  const matches = [...block.matchAll(relation)];
  return matches.flatMap((match, index) => {
    const body = block.slice(match.index, matches[index + 1]?.index ?? block.length);
    return /^          tenant_id:/m.test(body) ? [match[1]] : [];
  });
}

const schemaRelations = new Set([
  ...tenantRelations("Tables", "Views"),
  ...tenantRelations("Views", "Functions"),
]);
const missing = [...schemaRelations].filter((name) => !registry.has(name) && !exempt.has(name));
const stale = [...registry].filter((name) => !schemaRelations.has(name));
if (missing.length || stale.length || names.length !== registry.size) {
  console.error(JSON.stringify({ missing, stale, duplicateRegistryEntries: names.length - registry.size }, null, 2));
  process.exit(1);
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

let explicit = 0;
let centrallyGuarded = 0;
const pendingFiles = new Set();
for (const file of sourceFiles("src")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\.from\(\s*["']([A-Za-z0-9_]+)["']\s*\)/g)) {
    if (!registry.has(match[1])) continue;
    const chain = source.slice(match.index, match.index + 1800).split(";")[0];
    if (/tenant_id/.test(chain)) explicit += 1;
    else {
      centrallyGuarded += 1;
      pendingFiles.add(file);
    }
  }
}

console.log(JSON.stringify({
  tenantRelations: schemaRelations.size,
  centrallyProtectedRelations: registry.size,
  exemptAuthorizationRelations: [...exempt],
  directFrontendQueriesWithExplicitTenantFilter: explicit,
  directFrontendQueriesProtectedCentrally: centrallyGuarded,
  filesUsingCentralProtection: pendingFiles.size,
}, null, 2));

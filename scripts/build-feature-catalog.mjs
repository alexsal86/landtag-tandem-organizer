#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Funktionskatalog: führt den zentralen, versionierten Funktionsbestand
 * (`src/features/feature-catalog/inventory/*.json`), gleicht ihn mit dem Quellcode ab
 * und erzeugt die Dokumentation unter `docs/features/`.
 *
 * Der Katalog folgt dem tatsächlichen Quellcode. Selbsttest-Szenarien sind Prüfumfang,
 * nicht die Grundlage für die Existenz einer Funktion.
 *
 * Aufrufe:
 *   node scripts/build-feature-catalog.mjs            # Prüfung (CI)
 *   node scripts/build-feature-catalog.mjs --write    # Dokumentation neu erzeugen
 *   node scripts/build-feature-catalog.mjs --audit    # ausführlicher Inventarbericht
 *   node scripts/build-feature-catalog.mjs --report   # Abdeckungsbericht
 */

export const INVENTORY_DIR = 'src/features/feature-catalog/inventory';
export const EXCEPTIONS_FILE = 'src/features/feature-catalog/exceptions.json';
const GENERATED_MARKER = '_Auto-generiert mit `npm run update:feature-catalog`';

const CATEGORIES = ['fachlich', 'administrativ', 'automatisiert', 'integration', 'sicherheit', 'technisch'];
const IMPLEMENTATION = ['implementiert', 'teilweise', 'deaktiviert', 'verwaist', 'veraltet', 'entfernt', 'unklar'];
const INTEGRATION = ['ui', 'system', 'rollenabhaengig', 'feature-flag', 'ohne-einbindung', 'ungeprueft', 'nicht-anwendbar'];
const COVERAGE = ['selftest', 'unit', 'integration', 'browser', 'security', 'teilweise', 'keine', 'ungeprueft'];
const RESULTS = ['bestanden', 'fehlgeschlagen', 'nicht-ausgefuehrt', 'uebersprungen', 'voraussetzung-fehl', 'veraltet', 'unbekannt'];
const ROLES = ['abgeordneter', 'bueroleitung', 'mitarbeiter', 'praktikant', 'admin', 'superadmin', 'oeffentlich', 'system'];

const FEATURE_FIELDS = new Set([
  'id', 'area', 'subarea', 'name', 'description', 'category', 'implementationStatus', 'integrationStatus',
  'coverage', 'testResult', 'evidence', 'routes', 'components', 'services', 'hooks', 'edgeFunctions', 'rpcs',
  'tables', 'roles', 'dependsOn', 'scenarios', 'unitTests', 'integrationTests', 'e2eTests', 'docs',
  'limitations', 'reviewPoints',
]);

const LIST_FIELDS = ['routes', 'components', 'services', 'hooks', 'edgeFunctions', 'rpcs', 'tables', 'roles', 'dependsOn', 'scenarios', 'unitTests', 'integrationTests', 'e2eTests', 'docs', 'limitations', 'reviewPoints', 'evidence'];

const parseFile = (path) => ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
const nodeName = (node) => node?.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : undefined;
const member = (node, key) => node?.members?.find((m) => nodeName(m) === key) ?? node?.properties?.find((m) => nodeName(m) === key);

function literal(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map((p) => [nodeName(p), literal(p.initializer)]));
  }
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression);
  return undefined;
}

/* ------------------------------------------------------------------ Inventar */

/** Registrierte und deklarierte Selbsttest-Szenarien. */
export function collectScenarios(root) {
  const directory = join(root, 'src/features/selftest/scenarios');
  const registry = parseFile(join(root, 'src/features/selftest/registry.ts'));
  const array = registry.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => s.declarationList.declarations)
    .find((d) => d.name.getText() === 'SELFTEST_SCENARIOS')?.initializer;
  if (!array || !ts.isArrayLiteralExpression(array)) throw new Error('Szenario-Registry fehlt.');
  const elements = new Set(array.elements.map((e) => e.getText()));
  const registeredFiles = new Set();
  for (const statement of registry.statements.filter(ts.isImportDeclaration)) {
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings) && bindings.elements.some((e) => elements.has(e.name.text))) {
      registeredFiles.add(`${statement.moduleSpecifier.text.split('/').pop()}.ts`);
    }
  }
  return readdirSync(directory)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => {
      const declaration = parseFile(join(directory, file)).statements
        .filter(ts.isVariableStatement)
        .flatMap((s) => s.declarationList.declarations)
        .find((d) => ts.isObjectLiteralExpression(d.initializer) && member(d.initializer, 'touches'));
      const value = literal(declaration?.initializer);
      if (!value?.id) throw new Error(`Ungültiges Szenario: ${file}`);
      return {
        id: value.id,
        file,
        title: value.title ?? value.id,
        touches: Array.isArray(value.touches) ? value.touches : [],
        features: Array.isArray(value.features) ? value.features : [],
        checks: Array.isArray(value.checks) ? value.checks : [],
        limitations: Array.isArray(value.limitations) ? value.limitations : [],
        requiredRoles: Array.isArray(value.requiredRoles) ? value.requiredRoles : [],
        registered: registeredFiles.has(file),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Routen aus Router und Navigationskonfiguration. */
export function collectRoutes(root) {
  const routes = new Map();
  const add = (path, source) => {
    const normalized = path.split('?')[0].replace(/\/+$/, '') || '/';
    if (!normalized.startsWith('/')) return;
    if (['/', '*', '/:section', '/:section/:subId'].includes(normalized)) return;
    if (!routes.has(normalized)) routes.set(normalized, source);
  };

  const router = parseFile(join(root, 'src/router/routes.tsx'));
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText() === 'path' && node.initializer && ts.isStringLiteral(node.initializer)) {
      add(node.initializer.text, 'src/router/routes.tsx');
    }
    ts.forEachChild(node, visit);
  };
  visit(router);

  const navigation = parseFile(join(root, 'src/components/navigation/navigationConfig.ts'));
  const groups = navigation.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => s.declarationList.declarations)
    .find((d) => d.name.getText() === 'navigationGroups')?.initializer;
  if (groups && ts.isArrayLiteralExpression(groups)) {
    for (const group of groups.elements) {
      if (!ts.isObjectLiteralExpression(group)) continue;
      const route = member(group, 'route');
      const groupId = literal(member(group, 'id')?.initializer);
      if (route && ts.isPropertyAssignment(route)) {
        const value = literal(route.initializer);
        if (typeof value === 'string') add(value, 'src/components/navigation/navigationConfig.ts');
      }
      const subItems = member(group, 'subItems');
      if (subItems && ts.isPropertyAssignment(subItems) && ts.isArrayLiteralExpression(subItems.initializer)) {
        for (const item of subItems.initializer.elements) {
          if (!ts.isObjectLiteralExpression(item)) continue;
          const id = literal(member(item, 'id')?.initializer);
          if (typeof id === 'string') add(`/${id}`, 'src/components/navigation/navigationConfig.ts');
        }
      }
    }
  }
  return [...routes.entries()].map(([path, source]) => ({ path, source })).sort((a, b) => a.path.localeCompare(b.path));
}

/** Seitenmodule: eigenständige Einstiegskomponenten unter src/pages. */
export function collectPages(root) {
  const directory = join(root, 'src/pages');
  return readdirSync(directory)
    .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
    .map((file) => ({ name: file.replace(/\.tsx$/, ''), source: `src/pages/${file}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Edge Functions: Verzeichnisse mit index.ts (ohne gemeinsame Hilfsmodule). */
export function collectEdgeFunctions(root) {
  const directory = join(root, 'supabase/functions');
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .filter((entry) => existsSync(join(directory, entry.name, 'index.ts')))
    .map((entry) => ({ name: entry.name, source: `supabase/functions/${entry.name}/index.ts` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const isPublicSchemaFunction = (schema) => !schema || schema.toLowerCase() === 'public';

/**
 * Wirksame Datenbankfunktionen aus den Migrationen. Spätere Definitionen ersetzen frühere;
 * entfernte Funktionen werden aussortiert, damit historische Migrationen nicht als aktive
 * Funktionen erscheinen.
 */
function collectTypedFunctionNames(root) {
  const source = parseFile(join(root, 'src/integrations/supabase/types.ts'));
  const database = source.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const functions = member(member(database?.type, 'public')?.type, 'Functions')?.type?.members ?? [];
  return functions.map(nodeName).filter(Boolean);
}

export function collectRpcInventory(root) {
  const directory = join(root, 'supabase/migrations');
  const files = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  const definitions = new Map();
  for (const file of files) {
    const sql = readFileSync(join(directory, file), 'utf8');
    const pattern = /(create\s+(?:or\s+replace\s+)?function|drop\s+function)\s+(?:if\s+exists\s+)?(?:(?:"?([a-z0-9_]+)"?)\.)?"?([a-z0-9_]+)"?\s*\(/gi;
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      const [, verb, schema, name] = match;
      const key = isPublicSchemaFunction(schema) ? name : `${schema}.${name}`;
      if (/^drop/i.test(verb)) {
        if (definitions.has(key)) definitions.get(key).dropped = true;
      } else {
        definitions.set(key, { name: key, schema: schema ?? 'public', file: `supabase/migrations/${file}`, dropped: false });
      }
    }
  }
  const typed = collectTypedFunctionNames(root);
  // Wirksam ist die Vereinigung aus generierten Typen und nicht ausdrücklich entfernten
  // Migrationsfunktionen. Die Typen liefern neuere Funktionen ohne Migrationsherkunft,
  // die Migrationen Funktionen, die (noch) nicht in den Typen auftauchen.
  const active = new Map();
  for (const name of typed) {
    const definition = definitions.get(name);
    active.set(name, definition && !definition.dropped
      ? definition
      : { name, schema: name.includes('.') ? name.split('.')[0] : 'public', file: 'src/integrations/supabase/types.ts', dropped: false });
  }
  for (const definition of definitions.values()) {
    if (!definition.dropped && !active.has(definition.name)) active.set(definition.name, definition);
  }
  return [...active.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Tabellen und Views aus den generierten Supabase-Typen. */
export function collectTables(root) {
  const source = parseFile(join(root, 'src/integrations/supabase/types.ts'));
  const database = source.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const publicType = member(database?.type, 'public')?.type;
  const tables = member(publicType, 'Tables')?.type?.members?.map(nodeName).filter(Boolean) ?? [];
  const views = member(publicType, 'Views')?.type?.members?.map(nodeName).filter(Boolean) ?? [];
  return { tables: tables.sort(), views: views.sort() };
}

/** Fremdschlüssel aus den generierten Supabase-Typen (Relationships je Tabelle). */
export function collectEntityMap(root) {
  const source = parseFile(join(root, 'src/integrations/supabase/types.ts'));
  const database = source.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const tables = member(member(database?.type, 'public')?.type, 'Tables')?.type?.members ?? [];
  const edges = [];
  const seen = new Set();
  const tupleLiterals = (typeNode) => {
    if (!typeNode || !ts.isTupleTypeNode(typeNode)) return [];
    return typeNode.elements
      .map((element) => ts.isLiteralTypeNode(element) && ts.isStringLiteral(element.literal) ? element.literal.text : undefined)
      .filter(Boolean);
  };
  for (const table of tables) {
    const tableName = nodeName(table);
    if (!tableName) continue;
    const relationships = member(table.type, 'Relationships')?.type;
    if (!relationships || !ts.isTupleTypeNode(relationships)) continue;
    for (const relationship of relationships.elements) {
      if (!ts.isTypeLiteralNode(relationship)) continue;
      const columns = tupleLiterals(member(relationship, 'columns')?.type);
      const target = member(relationship, 'referencedRelation');
      const referenced = target?.type && ts.isLiteralTypeNode(target.type) && ts.isStringLiteral(target.type.literal)
        ? target.type.literal.text
        : undefined;
      if (!referenced) continue;
      const key = `${tableName}|${columns.join(',')}|${referenced}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: tableName, columns, to: referenced });
    }
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.columns.join(',').localeCompare(b.columns.join(',')));
  const inbound = new Map();
  for (const edge of edges) inbound.set(edge.to, [...(inbound.get(edge.to) ?? []), edge]);
  return { tables: tables.map(nodeName).filter(Boolean).sort(), edges, inbound };
}

/* ----------------------------------------------------------------- Katalog */

const LIST_DEFAULTS = Object.fromEntries(LIST_FIELDS.map((field) => [field, []]));

export function loadInventory(root) {
  const directory = join(root, INVENTORY_DIR);
  const errors = [];
  const areas = [];
  const features = [];
  const seenAreas = new Set();

  for (const file of readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
    let value;
    try {
      value = JSON.parse(readFileSync(join(directory, file), 'utf8'));
    } catch (error) {
      errors.push(`${INVENTORY_DIR}/${file}: ungültiges JSON (${error.message})`);
      continue;
    }
    if (!value?.area?.id || !value?.area?.title || !value?.area?.purpose) {
      errors.push(`${INVENTORY_DIR}/${file}: Bereichsdefinition (id/title/purpose) unvollständig`);
      continue;
    }
    if (seenAreas.has(value.area.id)) errors.push(`Doppelter Funktionsbereich: ${value.area.id}`);
    seenAreas.add(value.area.id);
    if (`${value.area.id}.json` !== file) errors.push(`${file}: Dateiname passt nicht zur Bereichs-ID ${value.area.id}`);
    areas.push(value.area);
    if (!Array.isArray(value.features) || value.features.length === 0) {
      errors.push(`Bereich ${value.area.id}: keine Funktionen erfasst`);
      continue;
    }
    for (const raw of value.features) {
      const defaults = Object.fromEntries(LIST_FIELDS.map((field) => [field, []]));
      const feature = { ...defaults, ...raw, area: value.area.id };
      for (const field of LIST_FIELDS) if (!Array.isArray(feature[field])) {
        errors.push(`${feature.id ?? file}: ${field} muss eine Liste sein`);
        feature[field] = [];
      }
      features.push(feature);
    }
  }
  return { areas, features, errors };
}

const unique = (values) => [...new Set(values)];

function normalizeRoute(route) {
  return route.split('?')[0].replace(/\/+$/, '') || '/';
}

/** Grobe, aber nachvollziehbare Abdeckung: exakt, spezifischer oder allgemeiner Präfix. */
function routeCovers(claim, target) {
  const a = normalizeRoute(claim);
  const b = normalizeRoute(target);
  if (a === b) return true;
  if (a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) return true;
  return false;
}

const RPC_TECHNICAL_PREFIXES = [
  '_', 'audit_', 'can_', 'claim_', 'cleanup_', 'config_', 'dispatch_', 'enforce_', 'ensure_', 'explain_',
  'field_', 'finish_', 'generate_', 'get_', 'guard_', 'handle_', 'has_', 'is_', 'list_', 'log_', 'mask_',
  'normalize_', 'notify_', 'parse_', 'permission_', 'propagate_', 'read_secured', 'refresh_', 'reorder_',
  'replace_', 'seed_', 'set_', 'snapshot_', 'start_', 'sync_', 'touch_', 'trg_', 'trigger_', 'update_', 'user_',
];

const isTechnicalRpc = (name) => {
  const bare = name.includes('.') ? name.split('.').pop() : name;
  return RPC_TECHNICAL_PREFIXES.some((prefix) => bare.startsWith(prefix));
};

export function validateCatalog(root, inventory) {
  const errors = [...inventory.errors];
  const warnings = [];
  const scenarios = collectScenarios(root);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const routes = collectRoutes(root);
  const edgeFunctions = collectEdgeFunctions(root);
  const edgeNames = new Set(edgeFunctions.map((entry) => entry.name));
  const pages = collectPages(root);
  const referencedPages = new Set();
  const rpcs = collectRpcInventory(root);
  const rpcNames = new Set(rpcs.map((entry) => entry.name));
  const { tables, views } = collectTables(root);
  const knownTables = new Set([...tables, ...views]);
  const areaIds = new Set(inventory.areas.map((area) => area.id));
  const generatedFeatureDocs = new Set(
    ['README', 'matrix', 'roles', 'dependencies', 'review', ...inventory.areas.map((area) => area.id)]
      .map((id) => `docs/features/${id}.md`),
  );
  const ids = new Set();
  const referencedScenarios = new Set();
  const referencedRoutes = new Set();
  const referencedEdgeFunctions = new Set();
  const referencedRpcs = new Set();
  const documentationCache = new Map();

  const pathExists = (relative) => {
    if (!documentationCache.has(relative)) documentationCache.set(relative, existsSync(join(root, relative)));
    return documentationCache.get(relative);
  };

  for (const feature of inventory.features) {
    const label = feature.id || '(ohne ID)';
    if (!feature.id) {
      errors.push('Funktion ohne ID');
      continue;
    }
    if (ids.has(feature.id)) errors.push(`Doppelte Funktions-ID: ${feature.id}`);
    ids.add(feature.id);
    if (!areaIds.has(feature.area)) errors.push(`${label}: unbekannter Bereich ${feature.area}`);
    for (const field of ['subarea', 'name', 'description', 'category', 'implementationStatus', 'integrationStatus', 'coverage', 'testResult']) {
      if (typeof feature[field] !== 'string' || !feature[field].trim()) errors.push(`${label}: Pflichtfeld ${field} fehlt`);
    }
    for (const key of Object.keys(feature)) {
      if (!FEATURE_FIELDS.has(key)) errors.push(`${label}: unbekanntes Feld ${key}`);
    }
    if (!CATEGORIES.includes(feature.category)) errors.push(`${label}: unbekannte Kategorie ${feature.category}`);
    if (!IMPLEMENTATION.includes(feature.implementationStatus)) errors.push(`${label}: unbekannter Implementierungsstatus ${feature.implementationStatus}`);
    if (!INTEGRATION.includes(feature.integrationStatus)) errors.push(`${label}: unbekannter Einbindungsstatus ${feature.integrationStatus}`);
    if (!COVERAGE.includes(feature.coverage)) errors.push(`${label}: unbekannter Testabdeckungsstatus ${feature.coverage}`);
    if (!RESULTS.includes(feature.testResult)) errors.push(`${label}: unbekannter Testergebnisstatus ${feature.testResult}`);
    for (const role of feature.roles) if (!ROLES.includes(role)) errors.push(`${label}: unbekannte Rolle ${role}`);

    if (feature.evidence.length === 0) errors.push(`${label}: mindestens ein Quellcode-Nachweis erforderlich`);
    const references = [
      ...feature.evidence,
      ...feature.components,
      ...feature.services,
      ...feature.hooks,
      ...feature.docs,
      ...feature.unitTests,
      ...feature.integrationTests,
      ...feature.e2eTests,
    ];
    for (const reference of references) {
      if (reference.startsWith('docs/features/')) {
        if (!generatedFeatureDocs.has(reference)) errors.push(`${label}: Doku-Verweis wird nicht generiert: ${reference}`);
        continue;
      }
      if (!pathExists(reference)) errors.push(`${label}: referenzierte Datei fehlt: ${reference}`);
    }
    for (const edge of feature.edgeFunctions) {
      referencedEdgeFunctions.add(edge);
      if (!edgeNames.has(edge)) errors.push(`${label}: unbekannte Edge Function ${edge}`);
    }
    for (const rpc of feature.rpcs) {
      referencedRpcs.add(rpc);
      if (!rpcNames.has(rpc)) errors.push(`${label}: unbekannte Datenbankfunktion ${rpc}`);
    }
    for (const table of feature.tables) {
      if (!knownTables.has(table)) errors.push(`${label}: unbekannte Tabelle ${table}`);
    }
    for (const scenario of feature.scenarios) {
      referencedScenarios.add(scenario);
      if (!scenarioById.has(scenario)) errors.push(`${label}: unbekannte Selbsttest-ID ${scenario}`);
      else if (!scenarioById.get(scenario).registered) warnings.push(`${label}: Selbsttest ${scenario} ist nicht registriert`);
    }
    for (const route of feature.routes) referencedRoutes.add(route);
    for (const reference of [...feature.evidence, ...feature.components]) {
      if (reference.startsWith('src/pages/')) referencedPages.add(reference);
    }

    const hasTest = Boolean(feature.scenarios.length || feature.unitTests.length || feature.integrationTests.length || feature.e2eTests.length);
    if (feature.coverage === 'keine' && hasTest) errors.push(`${label}: Abdeckung "keine", aber Tests zugeordnet`);
    if (feature.coverage !== 'keine' && feature.coverage !== 'ungeprueft' && !hasTest) {
      errors.push(`${label}: Abdeckung "${feature.coverage}" ohne zugeordneten Test`);
    }
  }

  for (const feature of inventory.features) {
    for (const dependency of feature.dependsOn) {
      if (dependency === feature.id) errors.push(`${feature.id}: Abhängigkeit auf sich selbst`);
      else if (!ids.has(dependency)) errors.push(`${feature.id}: unbekannte Abhängigkeit ${dependency}`);
    }
  }

  const unassignedRoutes = routes
    .filter((route) => !inventory.features.some((feature) => feature.routes.some((claim) => routeCovers(claim, route.path))))
    .map((route) => ({ kind: 'route', key: route.path, source: route.source }));
  const unassignedEdge = edgeFunctions
    .filter((entry) => !referencedEdgeFunctions.has(entry.name))
    .map((entry) => ({ kind: 'edge-function', key: entry.name, source: entry.source }));
  const unassignedRpc = rpcs
    .filter((entry) => !referencedRpcs.has(entry.name) && !isTechnicalRpc(entry.name))
    .map((entry) => ({ kind: 'rpc', key: entry.name, source: entry.file }));
  const unassignedScenarios = scenarios
    .filter((scenario) => scenario.registered && !referencedScenarios.has(scenario.id))
    .map((scenario) => ({ kind: 'scenario', key: scenario.id, source: `src/features/selftest/scenarios/${scenario.file}` }));
  const unreferencedPages = pages
    .filter((page) => !referencedPages.has(page.source))
    .map((page) => ({ kind: 'page', key: page.source, source: page.source }));

  const exceptions = loadExceptions(root, errors);
  const exceptionKeys = new Set(exceptions.map((entry) => `${entry.kind}|${entry.key}`));
  const candidates = [...unassignedRoutes, ...unassignedEdge, ...unassignedRpc, ...unassignedScenarios, ...unreferencedPages];
  const knownObjects = new Set([
    ...routes.map((route) => `route|${route.path}`),
    ...edgeFunctions.map((entry) => `edge-function|${entry.name}`),
    ...rpcs.map((entry) => `rpc|${entry.name}`),
    ...scenarios.filter((scenario) => scenario.registered).map((scenario) => `scenario|${scenario.id}`),
    ...pages.map((page) => `page|${page.source}`),
  ]);
  for (const exception of exceptions) {
    const key = `${exception.kind}|${exception.key}`;
    if (!knownObjects.has(key)) errors.push(`Ausnahme verweist auf unbekanntes Objekt: ${key}`);
  }

  const openCandidates = candidates.filter((candidate) => !exceptionKeys.has(`${candidate.kind}|${candidate.key}`));
  for (const candidate of openCandidates) {
    if (candidate.kind === 'route' || candidate.kind === 'edge-function') {
      errors.push(`Nicht zugeordnetes inventarisierbares Objekt (${candidate.kind}): ${candidate.key} — Funktion zuordnen oder begründete Ausnahme in ${EXCEPTIONS_FILE} erfassen`);
    } else {
      warnings.push(`Prüfkandidat ohne Funktionszuordnung (${candidate.kind}): ${candidate.key}`);
    }
  }

  const assignedAreaCounts = new Map(inventory.areas.map((area) => [area.id, inventory.features.filter((feature) => feature.area === area.id).length]));
  for (const [area, count] of assignedAreaCounts) if (count === 0) errors.push(`Bereich ohne Funktionen: ${area}`);

  return {
    inventory,
    scenarios,
    scenarioById,
    routes,
    edgeFunctions,
    rpcs,
    tables,
    views,
    errors,
    warnings,
    candidates,
    openCandidates,
    exceptions,
    referencedScenarios,
    referencedRoutes,
    referencedEdgeFunctions,
    referencedRpcs,
  };
}

function loadExceptions(root, errors) {
  const path = join(root, EXCEPTIONS_FILE);
  if (!existsSync(path)) return [];
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(value.exceptions)) {
      errors.push(`${EXCEPTIONS_FILE}: exceptions muss eine Liste sein`);
      return [];
    }
    return value.exceptions.filter((entry) => {
      if (!entry?.kind || !entry?.key || !entry?.reason) {
        errors.push(`${EXCEPTIONS_FILE}: Ausnahme ohne kind/key/reason`);
        return false;
      }
      return true;
    });
  } catch (error) {
    errors.push(`${EXCEPTIONS_FILE}: ungültiges JSON (${error.message})`);
    return [];
  }
}

/* -------------------------------------------------------------- Kennzahlen */

export function computeMetrics(features) {
  const areas = new Set(features.map((feature) => feature.area));
  const subareas = new Set(features.map((feature) => `${feature.area}/${feature.subarea}`));
  const hasTest = (feature) => feature.scenarios.length + feature.unitTests.length + feature.integrationTests.length + feature.e2eTests.length > 0;
  return {
    features: features.length,
    areas: areas.size,
    subareas: subareas.size,
    implemented: features.filter((feature) => feature.implementationStatus === 'implementiert').length,
    partial: features.filter((feature) => feature.implementationStatus === 'teilweise').length,
    disabled: features.filter((feature) => feature.implementationStatus === 'deaktiviert').length,
    orphaned: features.filter((feature) => feature.implementationStatus === 'verwaist').length,
    reviewCandidates: features.filter((feature) => feature.reviewPoints.length > 0 || feature.implementationStatus === 'unklar').length,
    withSelftest: features.filter((feature) => feature.scenarios.length > 0).length,
    withUnitTest: features.filter((feature) => feature.unitTests.length > 0).length,
    withIntegrationTest: features.filter((feature) => feature.integrationTests.length > 0).length,
    withBrowserTest: features.filter((feature) => feature.e2eTests.length > 0).length,
    withSecurityTest: features.filter((feature) => feature.coverage === 'security').length,
    withoutAnyTest: features.filter((feature) => !hasTest(feature)).length,
    missingDocumentation: features.filter((feature) => feature.docs.length === 0).length,
    withLimitations: features.filter((feature) => feature.limitations.length > 0).length,
    unverifiedIntegration: features.filter((feature) => ['ungeprueft', 'ohne-einbindung'].includes(feature.integrationStatus)).length,
    technicalAssignments: features.reduce((sum, feature) =>
      sum + feature.routes.length + feature.components.length + feature.services.length + feature.hooks.length +
      feature.edgeFunctions.length + feature.rpcs.length, 0),
  };
}

const hasTest = (feature) => feature.scenarios.length + feature.unitTests.length + feature.integrationTests.length + feature.e2eTests.length > 0;
const hasDocs = (feature) => feature.docs.length > 0;

/* -------------------------------------------------------------- Darstellung */

const cell = (value) => String(value).replace(/\|/g, '\\|');
const code = (value) => `\`${value}\``;
const codeList = (values) => values.length ? values.map(code).join(', ') : '—';
const bulletList = (values, fallback = 'Keine.') => values.length ? values.map((value) => `- ${value}`).join('\n') : `- ${fallback}`;
const labels = {
  coverage: { selftest: 'Selbsttest', unit: 'Unit-Test', integration: 'Integrationstest', browser: 'Browser-Test', security: 'Security-Test', teilweise: 'teilweise', keine: 'kein Test', ungeprueft: 'ungeprüft' },
  integration: { ui: 'UI', system: 'systemseitig', rollenabhaengig: 'rollenabhängig', 'feature-flag': 'Feature Flag', 'ohne-einbindung': 'ohne Einbindung', ungeprueft: 'ungeprüft', 'nicht-anwendbar': 'nicht anwendbar' },
};

function formatRoles(roles) {
  return roles.length ? roles.map(code).join(', ') : 'Keine besondere Rolle deklariert';
}

function featureDetail(feature) {
  const blocks = [
    `### ${code(feature.id)} — ${feature.name}`,
    feature.description,
    '',
    `- **Kategorie:** ${feature.category}`,
    `- **Implementierung:** ${feature.implementationStatus}`,
    `- **Einbindung:** ${labels.integration[feature.integrationStatus]}`,
    `- **Testabdeckung:** ${labels.coverage[feature.coverage]}`,
    `- **Letztes Testergebnis:** ${feature.testResult} (nicht aus der Existenz einer Testdatei abgeleitet)`,
    `- **Rollen:** ${formatRoles(feature.roles)}`,
    `- **Routen:** ${codeList(feature.routes)}`,
    `- **Frontend-Komponenten:** ${codeList(feature.components)}`,
    `- **Services:** ${codeList(feature.services)}`,
    `- **Hooks:** ${codeList(feature.hooks)}`,
    `- **Edge Functions:** ${codeList(feature.edgeFunctions)}`,
    `- **Datenbankfunktionen:** ${codeList(feature.rpcs)}`,
    `- **Tabellen:** ${codeList(feature.tables)}`,
    `- **Abhängigkeiten:** ${codeList(feature.dependsOn)}`,
    `- **Selbsttests:** ${codeList(feature.scenarios)}`,
    `- **Unit-Tests:** ${codeList(feature.unitTests)}`,
    `- **Integrationstests:** ${codeList(feature.integrationTests)}`,
    `- **Browser-Tests:** ${codeList(feature.e2eTests)}`,
    `- **Dokumentation:** ${codeList(feature.docs)}`,
    '',
    '**Nachweise im Quellcode**',
    '',
    bulletList(feature.evidence),
    '',
    '**Bekannte Einschränkungen**',
    '',
    bulletList(feature.limitations),
    '',
    '**Offene Prüfpunkte**',
    '',
    bulletList(feature.reviewPoints),
  ];
  return blocks.join('\n');
}

function renderArea(area, state) {
  const features = area.features;
  const metrics = computeMetrics(features);
  const subareas = unique(features.map((feature) => feature.subarea));
  const table = [
    '| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |',
    '|---|---|---|---|---|---|',
    ...features
      .slice()
      .sort((a, b) => a.subarea.localeCompare(b.subarea, 'de') || a.name.localeCompare(b.name, 'de'))
      .map((feature) => `| ${code(feature.id)} ${cell(feature.name)} | ${cell(feature.subarea)} | ${feature.category} | ${feature.implementationStatus} | ${labels.integration[feature.integrationStatus]} | ${labels.coverage[feature.coverage]} |`),
  ].join('\n');
  const scenarios = unique(features.flatMap((feature) => feature.scenarios)).sort();
  const scenarioRows = scenarios.map((id) => {
    const scenario = state.scenarioById.get(id);
    return `| ${code(id)} | ${cell(scenario?.title ?? 'unbekannt')} | ${scenario?.touches.length ?? 0} | ${scenario?.checks.length ?? 0} |`;
  });
  return `# ${area.title}\n\n` +
    `${GENERATED_MARKER} aus dem zentralen Funktionskatalog (\`${INVENTORY_DIR}/${area.id}.json\`). Nicht von Hand bearbeiten._\n\n` +
    `**Zweck:** ${area.purpose}\n\n` +
    `## Kennzahlen\n\n` +
    `- Funktionen: **${metrics.features}** in **${subareas.length}** Unterbereichen\n` +
    `- implementiert: **${metrics.implemented}**, teilweise: **${metrics.partial}**, deaktiviert: **${metrics.disabled}**, potenziell verwaist: **${metrics.orphaned}**\n` +
    `- ohne zugeordneten Test: **${metrics.withoutAnyTest}**\n` +
    `- ohne Dokumentationsverweis: **${metrics.missingDocumentation}**\n\n` +
    `## Funktionen\n\n${table}\n\n` +
    `## Unterbereiche\n\n${subareas.map((name) => `- ${name}`).join('\n') || '- Keine.'}\n\n` +
    `## Rollen\n\n${formatRoles(unique(features.flatMap((feature) => feature.roles)))}\n\n` +
    `## Datenbanktabellen\n\n${codeList(unique(features.flatMap((feature) => feature.tables)).sort())}\n\n` +
    `## Selbsttest-Szenarien\n\n` +
    (scenarioRows.length
      ? `| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |\n|---|---|---:|---:|\n${scenarioRows.join('\n')}`
      : 'Keine Szenarien zugeordnet. Das bedeutet nicht, dass der Bereich ungetestet ist – es fehlt eine Selbsttest-Abdeckung.') +
    `\n\n## Funktionsdetails\n\n${features.map(featureDetail).join('\n\n')}\n\n` +
    `## Regeln\n\nFachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).\n`;
}

function renderIndex(areas, features, state) {
  const metrics = computeMetrics(features);
  const areaRows = areas.map((area) => {
    const areaMetrics = computeMetrics(area.features);
    return `| [${cell(area.title)}](./${area.id}.md) | ${area.subareas.length} | ${areaMetrics.features} | ${areaMetrics.implemented} | ${areaMetrics.withoutAnyTest} | ${areaMetrics.missingDocumentation} |`;
  });
  const categoryRows = CATEGORIES.map((category) => `| ${category} | ${features.filter((feature) => feature.category === category).length} |`);
  const statusRows = IMPLEMENTATION.map((status) => `| ${status} | ${features.filter((feature) => feature.implementationStatus === status).length} |`);
  const integrationRows = INTEGRATION.map((status) => `| ${labels.integration[status]} | ${features.filter((feature) => feature.integrationStatus === status).length} |`);
  const coverageRows = COVERAGE.map((status) => `| ${labels.coverage[status]} | ${features.filter((feature) => feature.coverage === status).length} |`);
  const candidateCount = state.openCandidates.length;
  const warningCount = state.warnings.length;
  return `# Funktionskatalog\n\n` +
    `${GENERATED_MARKER}. Nicht von Hand bearbeiten._\n\n` +
    `Der Katalog ist das führende Verzeichnis des tatsächlich implementierten Funktionsumfangs. ` +
    `Er beschreibt keine Soll-Anforderungen. Quellcode liefert die Nachweise, Selbsttests den Prüfumfang, ` +
    `das Security-Cockpit Sicherheitsbefunde – ohne dass daraus automatisch ein bestandener Test wird.\n\n` +
    `## Kennzahlen\n\n` +
    `| Kennzahl | Wert |\n|---|---:|\n` +
    `| Erfasste Funktionen | ${metrics.features} |\n` +
    `| Funktionsbereiche | ${metrics.areas} |\n` +
    `| Unterbereiche | ${metrics.subareas} |\n` +
    `| Implementiert | ${metrics.implemented} |\n` +
    `| Teilweise implementiert | ${metrics.partial} |\n` +
    `| Deaktiviert | ${metrics.disabled} |\n` +
    `| Potenziell verwaist | ${metrics.orphaned} |\n` +
    `| Prüfkandidaten (offene Punkte) | ${metrics.reviewCandidates} |\n` +
    `| Funktionen mit Selbsttest | ${metrics.withSelftest} |\n` +
    `| Funktionen mit Unit-Test | ${metrics.withUnitTest} |\n` +
    `| Funktionen mit Integrationstest | ${metrics.withIntegrationTest} |\n` +
    `| Funktionen mit Browser-Test | ${metrics.withBrowserTest} |\n` +
    `| Funktionen mit Security-Test | ${metrics.withSecurityTest} |\n` +
    `| Funktionen ohne zugeordneten Test | ${metrics.withoutAnyTest} |\n` +
    `| Funktionen ohne Dokumentationsverweis | ${metrics.missingDocumentation} |\n` +
    `| Funktionen mit bekannten Einschränkungen | ${metrics.withLimitations} |\n` +
    `| Nicht nachweisbar eingebundene Funktionen | ${metrics.unverifiedIntegration} |\n` +
    `| Technische Zuordnungen | ${metrics.technicalAssignments} |\n\n` +
    `## Funktionsbereiche\n\n` +
    `| Bereich | Unterbereiche | Funktionen | implementiert | ohne Test | ohne Doku |\n|---|---:|---:|---:|---:|---:|\n${areaRows.join('\n')}\n\n` +
    `## Kategorien\n\n| Kategorie | Funktionen |\n|---|---:|\n${categoryRows.join('\n')}\n\n` +
    `## Implementierungsstatus\n\n| Status | Funktionen |\n|---|---:|\n${statusRows.join('\n')}\n\n` +
    `## Einbindungsstatus\n\n| Einbindung | Funktionen |\n|---|---:|\n${integrationRows.join('\n')}\n\n` +
    `## Testabdeckung\n\n| Abdeckung | Funktionen |\n|---|---:|\n${coverageRows.join('\n')}\n\n` +
    `## Konsistenz\n\n` +
    `Der Generator inventarisiert Routen, Edge Functions, wirksame Datenbankfunktionen, Tabellen, Testszenarien und Testdateien. ` +
    `Aktuell **${candidateCount}** nicht zugeordnete Prüfkandidaten und **${warningCount}** Review-Hinweise. ` +
    `Eindeutige Inkonsistenzen brechen \`npm run check:feature-catalog\` ab; Details: [Prüfbericht](./review.md).\n\n` +
    `## Dokumentation\n\n` +
    `- [Funktions- und Testabdeckungsmatrix](./matrix.md)\n` +
    `- [Rollen- und Berechtigungszuordnungen](./roles.md)\n` +
    `- [Modulübergreifende Abhängigkeiten](./dependencies.md)\n` +
    `- [Ungeprüfte Funktionen und Prüfkandidaten](./review.md)\n` +
    `- [Entitätskarte](../entity-map.md)\n\n` +
    `## Pflege\n\n` +
    `1. Funktion in \`${INVENTORY_DIR}/<bereich>.json\` erfassen oder aktualisieren.\n` +
    `2. Mindestens einen Quellcode-Nachweis in \`evidence\` hinterlegen.\n` +
    `3. Testzuordnung und Abdeckungsstatus ehrlich setzen; fehlende Tests bleiben sichtbar.\n` +
    `4. \`npm run update:feature-catalog\` und \`npm run check:feature-catalog\` ausführen.\n\n` +
    `Verbindlich: Abschnitt „Funktionskatalog\" in [AGENTS.md](../../AGENTS.md).\n`;
}

function renderMatrix(features) {
  const rows = features
    .slice()
    .sort((a, b) => a.area.localeCompare(b.area) || a.subarea.localeCompare(b.subarea, 'de') || a.name.localeCompare(b.name, 'de'))
    .map((feature) => `| ${code(feature.id)} | ${cell(feature.area)} | ${feature.category} | ${feature.implementationStatus} | ${labels.integration[feature.integrationStatus]} | ${labels.coverage[feature.coverage]} | ${feature.testResult} | ${feature.scenarios.length} | ${feature.unitTests.length} | ${feature.integrationTests.length} | ${feature.e2eTests.length} | ${feature.docs.length ? 'ja' : 'nein'} |`);
  return `# Funktions- und Testabdeckungsmatrix\n\n${GENERATED_MARKER}. Nicht von Hand bearbeiten._\n\n` +
    `Die Spalten zählen **zugeordnete** Prüfungen, nicht bestandene Läufe. „Ergebnis\" ist das zuletzt bekannte Ergebnis und bleibt ohne Laufnachweis \`nicht-ausgefuehrt\` oder \`unbekannt\`.\n\n` +
    `| Funktion | Bereich | Kategorie | Implementierung | Einbindung | Abdeckung | Ergebnis | Selbsttests | Unit | Integration | Browser | Doku |\n` +
    `|---|---|---|---|---|---|---|---:|---:|---:|---:|---|\n${rows.join('\n')}\n`;
}

function renderRoles(features) {
  const rows = ROLES.map((role) => {
    const assigned = features.filter((feature) => feature.roles.includes(role));
    return { role, assigned };
  }).filter((entry) => entry.assigned.length > 0);
  return `# Rollen- und Berechtigungszuordnungen\n\n${GENERATED_MARKER}. Nicht aus den Selbsttests, sondern aus den Funktionsdefinitionen. Nicht von Hand bearbeiten._\n\n` +
    `Die Angaben sind deklarierte Mindestrollen. Die tatsächlich wirksame Berechtigung liegt zusätzlich in RLS-Policies, ` +
    `Feldrechten und Aktionsberechtigungen; ein Rollenlabel ist kein Sicherheitsnachweis.\n\n` +
    `## Funktionen je Rolle\n\n` +
    rows.map(({ role, assigned }) => `### ${code(role)} — ${assigned.length} Funktionen\n\n${assigned.map((feature) => `- ${code(feature.id)} — ${feature.name}`).join('\n')}`).join('\n\n') +
    `\n\n## Rollen je Funktion\n\n| Funktion | Rollen |\n|---|---|\n` +
    features.slice().sort((a, b) => a.id.localeCompare(b.id)).map((feature) => `| ${code(feature.id)} | ${formatRoles(feature.roles)} |`).join('\n') + '\n';
}

function renderDependencies(features, areas) {
  const edges = [];
  for (const feature of features) {
    for (const dependency of feature.dependsOn) edges.push({ from: feature.id, to: dependency });
  }
  const areaEdges = new Map();
  for (const feature of features) {
    for (const dependency of feature.dependsOn) {
      const target = features.find((candidate) => candidate.id === dependency);
      if (!target || target.area === feature.area) continue;
      const key = `${feature.area}->${target.area}`;
      areaEdges.set(key, [...(areaEdges.get(key) ?? []), `${feature.id} → ${dependency}`]);
    }
  }
  const tableAreas = new Map();
  for (const feature of features) {
    for (const table of feature.tables) tableAreas.set(table, [...new Set([...(tableAreas.get(table) ?? []), feature.area])]);
  }
  const sharedTables = [...tableAreas.entries()].filter(([, areasForTable]) => areasForTable.length > 1).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const edgeByArea = new Map();
  for (const feature of features) {
    for (const edge of feature.edgeFunctions) edgeByArea.set(edge, [...new Set([...(edgeByArea.get(edge) ?? []), feature.area])]);
  }
  return `# Modulübergreifende Abhängigkeiten\n\n${GENERATED_MARKER}. Nicht von Hand bearbeiten._\n\n` +
    `## Funktionsabhängigkeiten\n\n` +
    (edges.length ? `| Funktion | hängt ab von |\n|---|---|\n${edges.map((edge) => `| ${code(edge.from)} | ${code(edge.to)} |`).join('\n')}` : 'Keine deklarierten Abhängigkeiten.') +
    `\n\n## Bereichsübergänge\n\n` +
    (areaEdges.size
      ? [...areaEdges.entries()].map(([key, list]) => `### ${key.replace('->', ' → ')}\n\n${list.map((entry) => `- ${entry}`).join('\n')}`).join('\n\n')
      : 'Keine bereichsübergreifenden Abhängigkeiten deklariert.') +
    `\n\n## Gemeinsam genutzte Tabellen\n\n` +
    (sharedTables.length
      ? `| Tabelle | Bereiche |\n|---|---|\n${sharedTables.map(([table, list]) => `| ${code(table)} | ${list.join(', ')} |`).join('\n')}`
      : 'Keine Tabelle wird von mehreren Bereichen deklariert.') +
    `\n\n## Edge Functions nach Bereich\n\n` +
    (edgeByArea.size
      ? `| Edge Function | Bereiche |\n|---|---|\n${[...edgeByArea.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([edge, list]) => `| ${code(edge)} | ${list.join(', ')} |`).join('\n')}`
      : 'Keine Edge Functions zugeordnet.') +
    `\n\n## Bereiche\n\n${areas.map((area) => `- ${code(area.id)} — ${area.title}`).join('\n')}\n`;
}

function renderReview(features, state) {
  const byKind = (kind) => state.openCandidates.filter((candidate) => candidate.kind === kind);
  const exceptionRows = state.exceptions.map((exception) => `| ${exception.kind} | ${code(exception.key)} | ${cell(exception.reason)} |`);
  const withoutTest = features.filter((feature) => !hasTest(feature));
  const withoutDocs = features.filter((feature) => !hasDocs(feature));
  const unverified = features.filter((feature) => ['ungeprueft', 'ohne-einbindung'].includes(feature.integrationStatus));
  const orphaned = features.filter((feature) => feature.implementationStatus === 'verwaist' || feature.implementationStatus === 'unklar');
  const inactive = features.filter((feature) => ['deaktiviert', 'veraltet', 'entfernt', 'verwaist', 'unklar'].includes(feature.implementationStatus));
  const reviewPoints = features.filter((feature) => feature.reviewPoints.length > 0 || feature.limitations.length > 0);
  return `# Prüfbericht des Funktionskatalogs\n\n${GENERATED_MARKER}. Nicht von Hand bearbeiten._\n\n` +
    `Dieser Bericht trennt **eindeutig nachweisbare Inkonsistenzen** von **heuristischen Prüfkandidaten**. ` +
    `Nur erstere lassen \`check:feature-catalog\` fehlschlagen; Kandidaten erzeugen Review-Hinweise.\n\n` +
    `## Ergebnis des letzten Katalogprüflaufs\n\n` +
    `Eindeutige Fehler werden im CI-Lauf ausgegeben und brechen die Prüfung ab; sie werden hier nicht dupliziert. ` +
    `Dieser Bericht listet die verbleibenden Review-Hinweise und Prüfkandidaten.\n\n` +
    `- Review-Hinweise: **${state.warnings.length}**\n` +
    `- Nicht zugeordnete Objekte: **${state.candidates.length}**, davon ohne Ausnahme: **${state.openCandidates.length}**\n\n` +
    (state.warnings.length ? `### Review-Hinweise\n\n${bulletList(state.warnings)}\n\n` : '') +
    `## Funktionen ohne zugeordneten Test (${withoutTest.length})\n\n` +
    (withoutTest.length ? withoutTest.map((feature) => `- ${code(feature.id)} — ${feature.name}`).join('\n') : '- Keine.') + '\n\n' +
    `## Funktionen ohne Dokumentationsverweis (${withoutDocs.length})\n\n` +
    (withoutDocs.length ? withoutDocs.map((feature) => `- ${code(feature.id)} — ${feature.name}`).join('\n') : '- Keine.') + '\n\n' +
    `## Nicht nachweisbar eingebundene Funktionen (${unverified.length})\n\n` +
    (unverified.length ? unverified.map((feature) => `- ${code(feature.id)} — ${feature.name} (${feature.integrationStatus})`).join('\n') : '- Keine.') + '\n\n' +
    `## Potenziell verwaiste oder unklare Funktionen (${orphaned.length})\n\n` +
    (orphaned.length ? orphaned.map((feature) => `- ${code(feature.id)} — ${feature.name} (${feature.implementationStatus})`).join('\n') : '- Keine.') + '\n\n' +
    `## Deaktivierte, veraltete und entfernte Funktionen (${inactive.length})\n\n` +
    (inactive.length ? inactive.map((feature) => `- ${code(feature.id)} — ${feature.name} (${feature.implementationStatus})`).join('\n') : '- Keine.') + '\n\n' +
    `## Funktionen mit Einschränkungen oder offenen Punkten (${reviewPoints.length})\n\n` +
    (reviewPoints.length
      ? reviewPoints.map((feature) => `### ${code(feature.id)}\n\n${bulletList([...feature.limitations, ...feature.reviewPoints])}`).join('\n\n')
      : 'Keine.') + '\n\n' +
    `## Nicht zugeordnete Prüfkandidaten\n\n` +
    `### Routen (${byKind('route').length})\n\n${byKind('route').length ? byKind('route').map((candidate) => `- ${code(candidate.key)} (${candidate.source})`).join('\n') : '- Keine.'}\n\n` +
    `### Edge Functions (${byKind('edge-function').length})\n\n${byKind('edge-function').length ? byKind('edge-function').map((candidate) => `- ${code(candidate.key)} (${candidate.source})`).join('\n') : '- Keine.'}\n\n` +
    `### Datenbankfunktionen ohne Zuordnung (${byKind('rpc').length})\n\nDiese Liste ist heuristisch gefiltert (technische Präfixe gelten als Hilfsfunktionen). ` +
    `Sie ist ein Prüfauftrag, keine automatische Aussage über Verwaistheit.\n\n` +
    (byKind('rpc').length ? byKind('rpc').map((candidate) => `- ${code(candidate.key)} (${candidate.source})`).join('\n') : '- Keine.') + '\n\n' +
    `### Registrierte Selbsttests ohne Funktionszuordnung (${byKind('scenario').length})\n\n` +
    (byKind('scenario').length ? byKind('scenario').map((candidate) => `- ${code(candidate.key)} (${candidate.source})`).join('\n') : '- Keine.') + '\n\n' +
    `### Seitenmodule ohne Funktionszuordnung (${byKind('page').length})\n\nHeuristik: Seiten unter \`src/pages\` ohne Verweis in \`evidence\` oder \`components\` einer Funktion. Der Befund ist ein Prüfauftrag, keine Löschfreigabe.\n\n` +
    (byKind('page').length ? byKind('page').map((candidate) => `- ${code(candidate.key)}`).join('\n') : '- Keine.') + '\n\n' +
    `## Dokumentierte Ausnahmen\n\n` +
    `Ausnahmen liegen versioniert in \`${EXCEPTIONS_FILE}\`; jede benötigt \`kind\`, \`key\` und \`reason\`.\n\n` +
    (exceptionRows.length ? `| Art | Objekt | Begründung |\n|---|---|---|\n${exceptionRows.join('\n')}` : 'Keine Ausnahmen dokumentiert.') + '\n';
}

function renderEntityMap(entityMap) {
  const hub = [...entityMap.inbound.entries()]
    .filter(([, edges]) => edges.length >= 3)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const hubs = hub.map(([table, edges]) =>
    `### ${code(table)} — ${edges.length} eingehende Verweise\n\n| Von | Spalte |\n|---|---|\n` +
    edges.map((edge) => `| ${code(edge.from)} | ${edge.columns.map(code).join(', ') || '—'} |`).join('\n')).join('\n\n');
  const all = entityMap.edges
    .map((edge) => `| ${code(edge.from)} | ${edge.columns.map(code).join(', ') || '—'} | ${code(edge.to)} |`).join('\n');
  return `# Entitätskarte\n\n` +
    `${GENERATED_MARKER} aus den Fremdschlüsseln in \`src/integrations/supabase/types.ts\`. Nicht von Hand bearbeiten._\n\n` +
    `${entityMap.tables.length} Tabellen, ${entityMap.edges.length} Fremdschlüsselverweise. Die Karte zeigt, welche Tabelle auf welche zeigt; fachliche Bedeutung steht im [Funktionskatalog](./features/README.md).\n\n` +
    `## Zentrale Tabellen\n\nTabellen mit mindestens drei eingehenden Verweisen.\n\n${hubs || 'Keine.'}\n\n` +
    `## Alle Verweise\n\n| Tabelle | Spalte | Zieltabelle |\n|---|---|---|\n${all || '| — | — | — |'}\n`;
}

export function renderCatalog(state, root = process.cwd()) {
  const features = state.inventory.features;
  const areas = state.inventory.areas
    .map((area) => ({ ...area, features: features.filter((feature) => feature.area === area.id), subareas: unique(features.filter((feature) => feature.area === area.id).map((feature) => feature.subarea)) }))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const files = new Map();
  files.set('docs/features/README.md', renderIndex(areas, features, state));
  files.set('docs/features/matrix.md', renderMatrix(features));
  files.set('docs/features/roles.md', renderRoles(features));
  files.set('docs/features/dependencies.md', renderDependencies(features, areas));
  files.set('docs/features/review.md', renderReview(features, state));
  files.set('docs/entity-map.md', renderEntityMap(collectEntityMap(root)));
  for (const area of areas) files.set(`docs/features/${area.id}.md`, renderArea(area, state));
  return files;
}

/* ------------------------------------------------------------------- Ablauf */

function printAudit(state) {
  const metrics = computeMetrics(state.inventory.features);
  console.log('[feature-catalog:audit]');
  console.log(`  Bereiche: ${metrics.areas}`);
  console.log(`  Funktionen: ${metrics.features}`);
  console.log(`  Unterbereiche: ${metrics.subareas}`);
  console.log(`  Technische Zuordnungen: ${metrics.technicalAssignments}`);
  console.log(`  Routen inventarisiert: ${state.routes.length}`);
  console.log(`  Edge Functions inventarisiert: ${state.edgeFunctions.length}`);
  console.log(`  Datenbankfunktionen (wirksam): ${state.rpcs.length}`);
  console.log(`  Tabellen: ${state.tables.length}, Views: ${state.views.length}`);
  console.log(`  Registrierte Selbsttests: ${state.scenarios.filter((scenario) => scenario.registered).length}`);
  console.log(`  Nicht zugeordnete Objekte: ${state.candidates.length} (ohne Ausnahme: ${state.openCandidates.length})`);
  const kinds = [...new Set(state.candidates.map((candidate) => candidate.kind))];
  for (const kind of kinds) {
    const list = state.candidates.filter((candidate) => candidate.kind === kind);
    console.log(`    ${kind}: ${list.length}`);
    if (process.argv.includes('--verbose')) for (const entry of list) console.log(`      - ${entry.key}`);
  }
}

function printReport(state) {
  const metrics = computeMetrics(state.inventory.features);
  console.log('[feature-catalog:coverage]');
  for (const [key, value] of Object.entries(metrics)) console.log(`  ${key}: ${value}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const inventory = loadInventory(root);
  const state = validateCatalog(root, inventory);
  const write = process.argv.includes('--write');
  const errors = [...state.errors];

  if (write || !process.argv.includes('--audit')) {
    const files = renderCatalog(state, root);
    for (const [file, expected] of files) {
      const target = join(root, file);
      if (write) {
        mkdirSync(resolve(target, '..'), { recursive: true });
        writeFileSync(target, expected);
      } else {
        let actual;
        try { actual = readFileSync(target, 'utf8'); } catch { /* fehlt */ }
        if (actual !== expected) errors.push(`${file} ist veraltet. npm run update:feature-catalog ausführen.`);
      }
    }
    if (write) {
      const directory = join(root, 'docs/features');
      for (const file of readdirSync(directory).filter((name) => name.endsWith('.md'))) {
        if (files.has(`docs/features/${file}`)) continue;
        const content = readFileSync(join(directory, file), 'utf8');
        if (content.includes(GENERATED_MARKER)) rmSync(join(directory, file));
        else errors.push(`docs/features/${file}: nicht generierte Datei im generierten Verzeichnis (bitte verschieben oder löschen)`);
      }
    }
  }

  if (process.argv.includes('--audit')) printAudit(state);
  if (process.argv.includes('--report')) printReport(state);

  console.log('[feature-catalog]', {
    areas: inventory.areas.length,
    features: inventory.features.length,
    unassignedRoutes: state.candidates.filter((candidate) => candidate.kind === 'route').length,
    unassignedEdgeFunctions: state.candidates.filter((candidate) => candidate.kind === 'edge-function').length,
    reviewRpcCandidates: state.candidates.filter((candidate) => candidate.kind === 'rpc').length,
    unassignedScenarios: state.candidates.filter((candidate) => candidate.kind === 'scenario').length,
    exceptions: state.exceptions.length,
    errors: errors.length,
    warnings: state.warnings.length,
  });
  for (const warning of state.warnings) console.warn('Hinweis:', warning);
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}

#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Funktionskatalog: erzeugt aus den Selbsttest-Szenarien je Bereich eine Seite plus
 * Index, dazu eine Entitätskarte aus den Fremdschlüsseln der generierten Typen.
 * Von Hand gepflegt wird nur die Bereichsliste (Zweck, Seiten, Doku-Verweise).
 */

export const AREAS = [
  {
    id: 'aufgaben',
    title: 'Aufgaben & Stafette',
    purpose: 'Aufgaben anlegen, zuweisen, über Fristen und Wiedervorlagen führen, im Stafette-Modell weitergeben und abschließen.',
    routes: ['/tasks', '/tasks/archive', '/tasks/new', '/mywork?tab=tasks', '/mywork?tab=dashboard'],
    scenarios: [
      'task-lifecycle',
      'task-stafette-lifecycle',
      'annual-task-stafette',
      'jour-fixe-platform-integration',
      'day-slip-lifecycle',
      'daily-briefing-lifecycle',
    ],
    docs: ['docs/my-work-architecture.md', 'docs/workflow-consistency.md', 'docs/automation-no-code-umsetzung.md'],
  },
  {
    id: 'vorgaenge',
    title: 'Vorgänge',
    purpose: 'Bürgeranliegen und Eingänge erfassen, „Wer ist am Zug?" führen, Schritte und Fristen setzen und den Vorgang abschließen.',
    routes: ['/vorgaenge/:caseItemId', '/mywork?tab=cases', '/casefiles'],
    scenarios: ['case-item-lifecycle'],
    docs: ['docs/case-items-intake-validation.md', 'docs/my-work-architecture.md'],
  },
  {
    id: 'termine',
    title: 'Termine & Briefings',
    purpose: 'Kalender, Terminanfragen, Briefings, Veranstaltungen und Terminabstimmungen inklusive Einladungs- und Erinnerungsregeln.',
    routes: ['/calendar', '/eventplanning', '/appointment-preparation/:id', '/briefing-live/:id'],
    scenarios: [
      'appointment-lifecycle',
      'appointment-request-lifecycle',
      'appointment-briefing-lifecycle',
      'event-planning-lifecycle',
      'poll-lifecycle',
    ],
    docs: ['docs/dossier-umsetzungsplan.md', 'docs/public-event-invitations.md', 'docs/rollenrechte-matrix.md'],
  },
  {
    id: 'entscheidungen',
    title: 'Entscheidungen',
    purpose: 'Entscheidungen anlegen, Teilnehmende abstimmen lassen, Antworten zurücknehmen und archivieren.',
    routes: ['/decisions', '/decision-response/:participantId'],
    scenarios: ['decision-lifecycle'],
    docs: ['docs/my-work-decisions-button-flowchart.md', 'docs/task-decision-reactions-rollout.md'],
  },
  {
    id: 'dokumente',
    title: 'Dokumente & Wissen',
    purpose: 'Dokumente ablegen, Anmerkungen und Antworten mit Aufgaben verknüpfen und den Wissensbereich nutzen.',
    routes: ['/documents', '/knowledge', '/wissen'],
    scenarios: ['document-list', 'document-annotation', 'knowledge-lifecycle'],
    docs: ['docs/knowledge-validity.md', 'docs/knowledge-global-question.md'],
  },
  {
    id: 'kontakte',
    title: 'Kontakte',
    purpose: 'Kontakte mit Stammdaten, Kategorien und Aktivitäten pflegen, Import-Duplikate auflösen und Zusammenführungen ohne Datenverlust ausführen.',
    routes: ['/contacts', '/contacts/:id', '/contacts/:id/edit', '/contacts/import'],
    scenarios: ['contact-lifecycle'],
    docs: ['docs/contacts-system-review.md', 'docs/contacts-overhaul-proposals.md'],
  },
  {
    id: 'mitarbeit',
    title: 'Mitarbeit & Personal',
    purpose: 'Onboarding und Offboarding, Mitarbeitergespräche, Zuständigkeiten und Teamrituale inklusive Sichtbarkeitsregeln.',
    routes: ['/employee', '/employee-meeting/:id', '/meetings'],
    scenarios: ['onboarding-hr', 'responsibilities', 'team-rituals', 'meeting-lifecycle'],
    docs: ['docs/employee-meeting-leadership.md', 'docs/team-rituals.md', 'docs/rollenrechte-matrix.md'],
  },
  {
    id: 'wahl',
    title: 'Wahlanalyse & Wahlhistorie',
    purpose: 'Wahlergebnisse auswerten, historische Mandate und Landeslisten lesen und die Wahlkreiskarte darstellen.',
    routes: ['/karten', '/daten'],
    scenarios: ['election-analysis', 'election-history-workbench', 'election-deputy-reader', 'election-map'],
    docs: ['docs/wahlanalyse.md', 'docs/wahlkreiskarte.md', 'docs/election-analysis'],
  },
];

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

function declaredScenarios(root) {
  const directory = join(root, 'src/features/selftest/scenarios');
  const registry = parseFile(join(root, 'src/features/selftest/registry.ts'));
  const registered = new Set();
  const array = registry.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => s.declarationList.declarations)
    .find((d) => d.name.getText() === 'SELFTEST_SCENARIOS')?.initializer;
  if (!array || !ts.isArrayLiteralExpression(array)) throw new Error('Szenario-Registry fehlt.');
  const elements = new Set(array.elements.map((e) => e.getText()));
  for (const statement of registry.statements.filter(ts.isImportDeclaration)) {
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings) && bindings.elements.some((e) => elements.has(e.name.text))) {
      registered.add(`${statement.moduleSpecifier.text.split('/').pop()}.ts`);
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
        registered: registered.has(file),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function tupleLiterals(typeNode) {
  if (!typeNode || !ts.isTupleTypeNode(typeNode)) return [];
  return typeNode.elements
    .map((element) => ts.isLiteralTypeNode(element) && ts.isStringLiteral(element.literal) ? element.literal.text : undefined)
    .filter(Boolean);
}

/** Fremdschlüssel aus den generierten Supabase-Typen (Relationships je Tabelle). */
export function collectEntityMap(root) {
  const source = parseFile(join(root, 'src/integrations/supabase/types.ts'));
  const database = source.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database');
  const tables = member(member(database?.type, 'public')?.type, 'Tables')?.type?.members ?? [];
  const edges = [];
  const seen = new Set();
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
  for (const edge of edges) {
    inbound.set(edge.to, [...(inbound.get(edge.to) ?? []), edge]);
  }
  return { tables: tables.map(nodeName).filter(Boolean).sort(), edges, inbound };
}

export function collectCatalog(root) {
  const scenarios = declaredScenarios(root);
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const errors = [];
  const used = new Set();

  const areas = AREAS.map((area) => {
    const assigned = area.scenarios.map((id) => {
      const scenario = byId.get(id);
      if (!scenario) errors.push(`Bereich ${area.id} verweist auf unbekanntes Szenario: ${id}`);
      if (used.has(id)) errors.push(`Szenario ${id} ist mehreren Bereichen zugeordnet`);
      used.add(id);
      return scenario;
    }).filter(Boolean);
    if (assigned.length === 0) errors.push(`Bereich ${area.id} hat kein Szenario`);
    if (assigned.some((scenario) => !scenario.registered)) {
      errors.push(`Bereich ${area.id} nutzt ein nicht registriertes Szenario`);
    }
    for (const doc of area.docs) {
      if (!existsSync(join(root, doc))) errors.push(`Doku-Verweis fehlt: ${doc} (Bereich ${area.id})`);
    }
    return {
      ...area,
      tables: [...new Set(assigned.flatMap((scenario) => scenario.touches))].sort(),
      roles: [...new Set(assigned.flatMap((scenario) => scenario.requiredRoles))].sort(),
      scenarios: assigned,
    };
  });

  const unassigned = scenarios.filter((scenario) => scenario.registered && !used.has(scenario.id));
  return { areas, scenarios, unassigned, errors };
}

const quoted = (values) => values.length ? values.map((v) => `\`${v}\``).join(', ') : '—';

function renderArea(area, entityMap) {
  const scenarioSections = area.scenarios.map((scenario) => {
    const checks = scenario.checks.length
      ? scenario.checks.map((check) => `  - ${check}`).join('\n')
      : '  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.';
    const limitations = scenario.limitations.length
      ? scenario.limitations.map((limitation) => `  - ${limitation}`).join('\n')
      : '  - Keine deklariert.';
    return `### \`${scenario.id}\` — ${scenario.title}\n\n- **Prüfungen:**\n${checks}\n- **Grenzen:**\n${limitations}`;
  }).join('\n\n');

  const tablesByScenario = new Map();
  for (const scenario of area.scenarios) {
    for (const table of scenario.touches) {
      tablesByScenario.set(table, [...(tablesByScenario.get(table) ?? []), scenario.id]);
    }
  }
  const tableRows = [...tablesByScenario.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([table, scenarioIds]) => `| \`${table}\` | ${scenarioIds.map((id) => `\`${id}\``).join(', ')} |`)
    .join('\n');

  const columns = (edge) => edge.columns.map((column) => `\`${column}\``).join(', ') || '—';
  const outgoing = entityMap.edges.filter((edge) => area.tables.includes(edge.from));
  const incoming = entityMap.edges.filter((edge) => area.tables.includes(edge.to));
  const outgoingSection = outgoing.length
    ? `| Tabelle | Spalte | Zieltabelle |\n|---|---|---|\n${outgoing.map((edge) => `| \`${edge.from}\` | ${columns(edge)} | \`${edge.to}\` |`).join('\n')}`
    : 'Keine ausgehenden Fremdschlüssel.';
  const incomingSection = incoming.length
    ? `| Zieltabelle im Bereich | Von | Spalte |\n|---|---|---|\n${incoming.map((edge) => `| \`${edge.to}\` | \`${edge.from}\` | ${columns(edge)} |`).join('\n')}`
    : 'Keine eingehenden Fremdschlüssel.';

  return `# ${area.title}\n\n` +
    `_Auto-generiert mit \`npm run update:feature-catalog\` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._\n\n` +
    `**Zweck:** ${area.purpose}\n\n` +
    `## Seiten\n\n${area.routes.map((route) => `- \`${route}\``).join('\n')}\n\n` +
    `## Rollen\n\n${area.roles.length ? `${quoted(area.roles)} (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)` : 'Keine besondere Rolle deklariert; es gilt die aktive Büro-Mitgliedschaft.'}\n\n` +
    `## Tabellen\n\nDiese Tabellen schreiben die Szenarien laut \`touches\`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.\n\n` +
    `| Tabelle | Szenario |\n|---|---|\n${tableRows || '| — | — |'}\n\n` +
    `## Fremdschlüssel\n\n${area.tables.length
      ? 'Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.'
      : 'Der Bereich schreibt laut Szenarien keine Tabellen (nur lesende Prüfungen), deshalb sind hier keine Verweise zugeordnet; die Datenebene steht in `docs/entity-map.md`.'}\n\n` +
    `### Ausgehend\n\n${outgoingSection}\n\n` +
    `### Eingehend\n\n${incomingSection}\n\n` +
    `## Prüfumfang\n\n${scenarioSections}\n\n` +
    `## Detaildoku\n\n${area.docs.map((doc) => doc.endsWith('/') || !doc.endsWith('.md') ? `- \`${doc}\`` : `- [${doc.split('/').pop()}](../${doc.split('/').pop()})`).join('\n')}\n\n` +
    `## Regeln\n\nFachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).\n`;
}

function renderIndex(catalog) {
  const rows = catalog.areas.map((area) =>
    `| [${area.title}](./${area.id}.md) | ${area.routes.map((route) => `\`${route}\``).join(', ')} | ${area.scenarios.length} | ${area.tables.length} | ${area.roles.length ? area.roles.map((role) => `\`${role}\``).join(', ') : '—'} |`).join('\n');
  const unassigned = catalog.unassigned.length
    ? catalog.unassigned.map((scenario) => `- \`${scenario.id}\` — ${scenario.title}`).join('\n')
    : '- Keine.';
  return `# Funktionskatalog\n\n` +
    `_Auto-generiert mit \`npm run update:feature-catalog\`. Nicht von Hand bearbeiten._\n\n` +
    `Der Katalog ist ein Zeiger, keine zweite Wahrheit: Zweck, Seiten und Rollen stammen aus dieser Bereichsliste, ` +
    `Prüfumfang und Tabellen aus den Selbsttest-Szenarien, die Fremdschlüssel aus \`docs/entity-map.md\`. ` +
    `Die Regeln selbst stehen in [AGENTS.md](../../AGENTS.md).\n\n` +
    `${catalog.areas.length} Bereiche mit zusammen ${catalog.areas.reduce((sum, area) => sum + area.scenarios.length, 0)} Szenarien.\n\n` +
    `## Bereiche\n\n| Bereich | Seiten | Szenarien | Tabellen | Rollen |\n|---|---|---:|---:|---|\n${rows}\n\n` +
    `## Szenarien ohne eigenen Bereich\n\nDiese Szenarien sind registriert, aber keinem der Startbereiche zugeordnet. ` +
    `Sie zuordnen oder bewusst hier stehen lassen.\n\n${unassigned}\n\n` +
    `## Pflege\n\n` +
    `- Bereich hinzufügen oder Seiten ändern: \`scripts/build-feature-catalog.mjs\`.\n` +
    `- Prüfungen ändern: das jeweilige Szenario unter \`src/features/selftest/scenarios\`.\n` +
    `- Danach \`npm run update:feature-catalog\`; \`npm run check:feature-catalog\` meldet Abweichungen in der CI.\n`;
}

function renderEntityMap(entityMap) {
  const hub = [...entityMap.inbound.entries()]
    .filter(([, edges]) => edges.length >= 3)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const hubs = hub.map(([table, edges]) =>
    `### \`${table}\` — ${edges.length} eingehende Verweise\n\n| Von | Spalte |\n|---|---|\n` +
    edges.map((edge) => `| \`${edge.from}\` | ${edge.columns.map((column) => `\`${column}\``).join(', ') || '—'} |`).join('\n')).join('\n\n');
  const all = entityMap.edges
    .map((edge) => `| \`${edge.from}\` | ${edge.columns.map((column) => `\`${column}\``).join(', ') || '—'} | \`${edge.to}\` |`).join('\n');
  return `# Entitätskarte\n\n` +
    `_Auto-generiert mit \`npm run update:feature-catalog\` aus den Fremdschlüsseln in \`src/integrations/supabase/types.ts\`. Nicht von Hand bearbeiten._\n\n` +
    `${entityMap.tables.length} Tabellen, ${entityMap.edges.length} Fremdschlüsselverweise. Die Karte zeigt, welche Tabelle auf welche zeigt; fachliche Bedeutung steht im [Funktionskatalog](./features/README.md).\n\n` +
    `## Zentrale Tabellen\n\nTabellen mit mindestens drei eingehenden Verweisen.\n\n${hubs || 'Keine.'}\n\n` +
    `## Alle Verweise\n\n| Tabelle | Spalte | Zieltabelle |\n|---|---|---|\n${all || '| — | — | — |'}\n`;
}

export function renderCatalog(catalog, entityMap) {
  const files = new Map([
    ['docs/features/README.md', renderIndex(catalog)],
    ['docs/entity-map.md', renderEntityMap(entityMap)],
  ]);
  for (const area of catalog.areas) files.set(`docs/features/${area.id}.md`, renderArea(area, entityMap));
  return files;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const catalog = collectCatalog(root);
  const entityMap = collectEntityMap(root);
  const files = renderCatalog(catalog, entityMap);
  const errors = [...catalog.errors];
  for (const [file, expected] of files) {
    const target = join(root, file);
    if (process.argv.includes('--write')) {
      mkdirSync(resolve(target, '..'), { recursive: true });
      writeFileSync(target, expected);
    } else {
      let actual;
      try { actual = readFileSync(target, 'utf8'); } catch { /* fehlt */ }
      if (actual !== expected) errors.push(`${file} ist veraltet. npm run update:feature-catalog ausführen.`);
    }
  }
  console.log('[feature-catalog]', {
    areas: catalog.areas.length,
    scenarios: catalog.areas.reduce((sum, area) => sum + area.scenarios.length, 0),
    unassigned: catalog.unassigned.length,
    tables: entityMap.tables.length,
    foreignKeys: entityMap.edges.length,
  });
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
}

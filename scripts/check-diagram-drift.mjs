import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf-8");

const constantsFile = "src/components/administration/system-overview/myWorkDiagramConstants.ts";
const overviewFile = "src/components/administration/MyWorkSystemOverview.tsx";
const notesFile = "src/components/shared/QuickNotesList.tsx";

const constantsSource = read(constantsFile);
const overviewSource = read(overviewFile);
const notesSource = read(notesFile);

const handlerRegex = /([A-Za-z0-9_]+):\s*"([A-Za-z0-9_]+)"/g;
const handlers = [...constantsSource.matchAll(handlerRegex)].map((m) => ({
  key: m[1],
  name: m[2],
}));

if (handlers.length === 0) {
  console.error("No diagram handlers found in constants file.");
  process.exit(1);
}

const missingInSource = handlers
  .map((h) => h.name)
  .filter((name) => !notesSource.includes(name));

const missingInOverview = handlers
  .map((h) => h.key)
  .filter((key) => !overviewSource.includes(`CAPTURE_DIAGRAM_HANDLERS.${key}`) && !overviewSource.includes(`CAPTURE_DIAGRAM_LABELS.${key}`));

if (missingInSource.length || missingInOverview.length) {
  if (missingInSource.length) {
    console.error("Handler existiert nicht mehr im Produktivcode (QuickNotesList):");
    missingInSource.forEach((name) => console.error(` - ${name}`));
  }
  if (missingInOverview.length) {
    console.error("Konstante wird in Diagrammen nicht verwendet:");
    missingInOverview.forEach((key) => console.error(` - ${key}`));
  }
  process.exit(1);
}

console.log(`Diagram drift check passed (${handlers.length} handler refs).`);

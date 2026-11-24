#!/usr/bin/env node
import fs from "node:fs";

const docFile = "docs/my-work-architecture.md";
const sourceFiles = [
  "src/components/shared/QuickNotesList.tsx",
  "src/features/quick-notes/useQuickNoteLinks.ts",
  "src/features/quick-notes/useQuickNoteActions.ts",
  "src/features/quick-notes/useQuickNoteDialogs.ts",
];

// Handler, die in der Architektur-Doku und im Produktivcode vorkommen müssen.
const handlers = [
  "createTaskFromNote",
  "removeTaskFromNote",
  "removeDecisionFromNote",
  "handleSetFollowUp",
  "setConfirmDeleteTaskNote",
  "setNoteForDatePicker",
  "loadNotes",
];

const read = (file) => fs.readFileSync(file, "utf-8");

const doc = read(docFile);
const source = sourceFiles.map(read).join("\n");

const missingInSource = handlers.filter((name) => !source.includes(name));
const missingInDoc = handlers.filter((name) => !doc.includes(name));

if (missingInSource.length || missingInDoc.length) {
  if (missingInSource.length) {
    console.error("Handler existiert nicht mehr im Produktivcode:");
    missingInSource.forEach((name) => console.error(` - ${name}`));
  }
  if (missingInDoc.length) {
    console.error(`Handler fehlt in ${docFile}:`);
    missingInDoc.forEach((name) => console.error(` - ${name}`));
  }
  process.exit(1);
}

console.log(`Diagram drift check passed (${handlers.length} handler refs, ${docFile}).`);

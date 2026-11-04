import type { Plugin } from "vite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Run after Vite removes CSS-only JS chunks: a precache list containing one of
 * those temporary chunk names would make service-worker installation fail. */
export function quickNotesOfflineShell(): Plugin {
  return {
    name: "quick-notes-offline-shell",
    apply: "build",
    writeBundle(options, bundle) {
      const directory = options.dir ?? "dist";
      const assets = new Set<string>(["/index.html", "/favicon.ico", "/favicon.svg", "/manifest.webmanifest"]);
      const visit = (name: string) => {
        if (assets.has(`/${name}`) || !existsSync(path.join(directory, name))) return;
        const chunk = bundle[name];
        if (!chunk || chunk.type !== "chunk") return;
        assets.add(`/${name}`);
        chunk.imports.forEach(visit);
      };
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && (output.isEntry || output.moduleIds.some(id => /\/(pages\/Index|MyWorkView|GlobalQuickNoteDialog)\.tsx$/.test(id)))) visit(output.fileName);
        if (output.fileName.endsWith(".css") && existsSync(path.join(directory, output.fileName))) assets.add(`/${output.fileName}`);
      }
      const files = [...assets].sort();
      const hash = createHash("sha256");
      for (const file of files) hash.update(file).update(readFileSync(path.join(directory, file)));
      const version = hash.digest("hex").slice(0, 16);
      writeFileSync(path.join(directory, "quick-notes-shell.js"), `self.QUICK_NOTES_SHELL = ${JSON.stringify({ version, assets: files })};`);
    },
  };
}

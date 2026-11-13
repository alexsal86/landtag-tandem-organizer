import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Serve pinned OCR runtime and German language data from our own origin in dev and builds. */
export function annotationOcrAssets(): Plugin {
  const prefix = "/annotation-ocr/";
  const assets: Record<string, string> = {
    "worker.min.js": "tesseract.js/dist/worker.min.js",
    "tesseract-core-lstm.wasm.js":
      "tesseract.js-core/tesseract-core-lstm.wasm.js",
    "tesseract-core-lstm.wasm": "tesseract.js-core/tesseract-core-lstm.wasm",
    "tesseract-core-simd-lstm.wasm.js":
      "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm":
      "tesseract.js-core/tesseract-core-simd-lstm.wasm",
    "deu.traineddata.gz":
      "@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz",
  };
  const sourcePath = (name: string) =>
    path.resolve("node_modules", assets[name]);
  return {
    name: "annotation-ocr-assets",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (!pathname.startsWith(prefix)) return next();
        const name = pathname.slice(prefix.length);
        if (!Object.prototype.hasOwnProperty.call(assets, name)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        try {
          const data = await readFile(sourcePath(name));
          res.setHeader(
            "Content-Type",
            name.endsWith(".js")
              ? "application/javascript"
              : name.endsWith(".wasm")
                ? "application/wasm"
                : "application/octet-stream",
          );
          res.end(data);
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      for (const name of Object.keys(assets))
        this.emitFile({
          type: "asset",
          fileName: `annotation-ocr/${name}`,
          source: await readFile(sourcePath(name)),
        });
    },
  };
}

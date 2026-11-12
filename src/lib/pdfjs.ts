import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// The legacy build supplies newer APIs (e.g. Uint8Array.toHex) in both the
// browser and the worker. Keep every consumer on this matching installed pair.
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export * from 'pdfjs-dist/legacy/build/pdf.mjs';

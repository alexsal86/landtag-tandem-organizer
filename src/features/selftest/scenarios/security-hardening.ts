import {
  PORTRAIT_LARGE, PORTRAIT_SIZE, PORTRAIT_THUMB,
  isDeputyPortrait, portraitCrop, portraitSource, validPortraitWebp,
} from "../../../../supabase/functions/_shared/deputyPortrait";
import { escapeHtml, safeUrl, sanitizeEmailHtml } from "../../../../supabase/functions/_shared/html";
import type { TestScenario } from "../types";

const WEBP_LENGTH = 40;

/** Baut einen minimalen RIFF/WebP-Container mit VP8X-Kopf und den gewünschten Maßen. */
function webp(kind: "VP8X" | "VP8L", width: number, height: number, length = WEBP_LENGTH): Uint8Array {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };
  ascii(0, "RIFF");
  view.setUint32(4, length - 8, true);
  ascii(8, "WEBP");
  ascii(12, kind);
  if (kind === "VP8X") {
    const w = width - 1;
    const h = height - 1;
    bytes[24] = w & 0xff; bytes[25] = (w >> 8) & 0xff; bytes[26] = (w >> 16) & 0xff;
    bytes[27] = h & 0xff; bytes[28] = (h >> 8) & 0xff; bytes[29] = (h >> 16) & 0xff;
  }
  return bytes;
}

const VERSION = "12345678-90ab-cdef-1234-567890abcdef";
const HASH = "0123456789abcdef";

export const securityHardeningScenario: TestScenario = {
  id: "security-hardening",
  title: "Sicherheitsregeln: Porträtdateien und E-Mail-Inhalte",
  description: "Prüft die geteilten Datei- und HTML-Prüfregeln ohne Datenbankzugriff, Upload oder E-Mail-Versand.",
  features: ["permissions"],
  touches: [],
  checks: [
    "Porträt-WebP: Signatur, RIFF-Länge und Pflichtmaße je Variante",
    "Porträt-Metadaten: Quelle, Verbindung und Dateinamen",
    "Bildzuschnitt deckt das 3:4-Format und begrenzt Zoom sowie Versatz",
    "E-Mail-HTML entfernt Skripte, Ereignis-Handler und aktive URLs",
  ],
  limitations: [
    "Der tatsächliche GitHub-Commit, der Upload und die Veröffentlichung durch den Hoster laufen in der Edge Function und werden hier nicht geprüft.",
    "E-Mail-Versand, Zustellung und Rendering in fremden Clients bleiben ungeprüft; ausgeführt wird nur die gemeinsame Vorprüfung.",
  ],
  steps: [
    {
      id: "portrait-files", label: "Porträtdateien: WebP-Signatur, RIFF-Länge und Pflichtmaße", kind: "logic",
      run: async () => {
        const portrait = webp("VP8X", PORTRAIT_SIZE.width, PORTRAIT_SIZE.height);
        const thumb = webp("VP8X", PORTRAIT_THUMB.width, PORTRAIT_THUMB.height);
        const large = webp("VP8X", PORTRAIT_LARGE.width, PORTRAIT_LARGE.height);
        const brokenRiff = webp("VP8X", PORTRAIT_SIZE.width, PORTRAIT_SIZE.height);
        new DataView(brokenRiff.buffer).setUint32(4, 0, true);
        const brokenMagic = webp("VP8X", PORTRAIT_SIZE.width, PORTRAIT_SIZE.height);
        brokenMagic[0] = 0x58;
        const checks = {
          portrait: validPortraitWebp(portrait),
          thumbnail: validPortraitWebp(thumb, true),
          large: validPortraitWebp(large, "large"),
          portraitAsThumbnail: !validPortraitWebp(portrait, true),
          thumbAsPortrait: !validPortraitWebp(thumb),
          wrongDimensions: !validPortraitWebp(webp("VP8X", PORTRAIT_SIZE.width + 1, PORTRAIT_SIZE.height)),
          brokenRiffLength: !validPortraitWebp(brokenRiff),
          brokenMagic: !validPortraitWebp(brokenMagic),
          unknownHeader: !validPortraitWebp(webp("VP8L", PORTRAIT_SIZE.width, PORTRAIT_SIZE.height)),
          tooShort: !validPortraitWebp(new Uint8Array(20)),
          tooLarge: !validPortraitWebp(webp("VP8X", PORTRAIT_SIZE.width, PORTRAIT_SIZE.height, PORTRAIT_SIZE.maxBytes + 1)),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Nur echte WebP-Dateien mit passender RIFF-Länge und exakten Maßen werden angenommen.",
          details: checks,
        };
      },
    },
    {
      id: "portrait-source", label: "Porträtquelle: nur http(s) ohne Zugangsdaten und mit Feldgrenzen", kind: "logic",
      run: async () => {
        const source = portraitSource({ label: "  Landtag BW  ", url: "https://example.org/portrait.jpg", author: " Foto ", license: "CC BY 4.0" });
        const checks = {
          trimmed: source?.label === "Landtag BW" && source?.author === "Foto",
          normalisedUrl: source?.url === "https://example.org/portrait.jpg",
          rejectsScriptScheme: portraitSource({ label: "x", url: "javascript:alert(1)", author: "", license: "" }) === null,
          rejectsDataUrl: portraitSource({ label: "x", url: "data:image/webp;base64,AAAA", author: "", license: "" }) === null,
          rejectsCredentials: portraitSource({ label: "x", url: "https://user:pass@example.org/a.jpg", author: "", license: "" }) === null,
          rejectsMissingFields: portraitSource({ label: "x", url: "https://example.org/a.jpg" }) === null,
          rejectsLongUrl: portraitSource({ label: "x", url: `https://example.org/${"a".repeat(2048)}`, author: "", license: "" }) === null,
          allowsEmptyUrl: portraitSource({ label: "Eigene Aufnahme", url: "", author: "", license: "" }) !== null,
          rejectsNonObject: portraitSource("https://example.org/a.jpg") === null && portraitSource(null) === null,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Quellen werden getrimmt, aber nur als vollständige http(s)-Adresse ohne Zugangsdaten übernommen.",
          details: checks,
        };
      },
    },
    {
      id: "portrait-record", label: "Porträt-Metadaten: Verbindung, Versions-ID und feste Dateinamen", kind: "logic",
      run: async () => {
        const base = {
          schemaVersion: 1 as const, connectionId: "conn-1", version: VERSION,
          image: `portrait-${HASH}.webp`, thumbnail: `thumb-${HASH}.webp`, largeImage: `large-${HASH}.webp`,
          source: { label: "Quelle", url: "https://example.org/a.jpg", author: "A", license: "CC0" },
          updatedAt: "2026-11-25T10:00:00Z",
        };
        const checks = {
          valid: isDeputyPortrait(base, "conn-1"),
          optionalLargeImage: isDeputyPortrait({ ...base, largeImage: undefined }, "conn-1"),
          foreignConnection: !isDeputyPortrait(base, "conn-2"),
          traversalName: !isDeputyPortrait({ ...base, image: `../portrait-${HASH}.webp` }, "conn-1"),
          shortHash: !isDeputyPortrait({ ...base, thumbnail: "thumb-0123456789abcde.webp" }, "conn-1"),
          unknownLargeImage: !isDeputyPortrait({ ...base, largeImage: "large-foto.webp" }, "conn-1"),
          invalidVersion: !isDeputyPortrait({ ...base, version: "version-1" }, "conn-1"),
          unsafeSource: !isDeputyPortrait({ ...base, source: { ...base.source, url: "javascript:alert(1)" } }, "conn-1"),
          wrongSchema: !isDeputyPortrait({ ...base, schemaVersion: 2 }, "conn-1"),
          missingTimestamp: !isDeputyPortrait({ ...base, updatedAt: undefined as unknown as string }, "conn-1"),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Ein Porträt gilt nur für seine Mandatsverbindung und nur mit festen Dateinamen im Zielverzeichnis.",
          details: checks,
        };
      },
    },
    {
      id: "portrait-crop", label: "Bildzuschnitt: 3:4-Rahmen, begrenzter Zoom und geklemmter Versatz", kind: "logic",
      run: async () => {
        const exact = portraitCrop(480, 640, 1, 0, 0);
        const zoomed = portraitCrop(480, 640, 2, 0, 0);
        const capped = portraitCrop(480, 640, 9, 0, 0);
        const floored = portraitCrop(480, 640, 0, 0, 0);
        const wide = portraitCrop(1600, 400, 1, 99999, 99999);
        const frameRatio = (crop: { sourceWidth: number; sourceHeight: number }) =>
          Math.abs(crop.sourceWidth / crop.sourceHeight - 0.75) < 1e-9;
        const checks = {
          fullFrame: exact.sourceWidth === 480 && exact.sourceHeight === 640 && exact.sourceX === 0 && exact.sourceY === 0 && exact.scale === 0.5,
          zoomCrops: zoomed.sourceWidth === 240 && zoomed.sourceHeight === 320 && zoomed.sourceX === 120 && zoomed.sourceY === 160,
          zoomCapped: capped.scale === 2 && capped.sourceWidth === 120 && capped.sourceHeight === 160,
          zoomFloored: floored.scale === 0.5 && floored.sourceWidth === 480,
          offsetClamped: wide.offsetX === 520 && wide.offsetY === 0 && wide.sourceX === 0 && wide.sourceY === 0,
          wideScale: wide.scale === 0.8 && wide.sourceWidth === 300 && wide.sourceHeight === 400,
          alwaysThreeToFour: [exact, zoomed, capped, floored, wide].every(frameRatio),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Der Ausschnitt deckt immer den gesamten 3:4-Rahmen; Zoom bleibt zwischen 1 und 4, der Versatz am Bildrand.",
          details: checks,
        };
      },
    },
    {
      id: "email-html", label: "E-Mail-HTML: maskieren, sichere Links und entfernte aktive Inhalte", kind: "logic",
      run: async () => {
        const stripped = sanitizeEmailHtml(
          '<p onclick="alert(1)">Hallo</p><script>alert(1)</script><iframe src="https://evil.example"></iframe>' +
          '<a href="javascript:alert(1)">Klick</a><img src="x" onerror="alert(1)">',
        );
        const checks = {
          escapeAll: escapeHtml('<a href="x">Tom & Jerry\'s</a>') === "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
          escapeEmpty: escapeHtml(null) === "" && escapeHtml(7) === "7",
          safeLink: safeUrl("https://example.org/a?b=1&c=2") === "https://example.org/a?b=1&amp;c=2",
          mailtoAllowed: safeUrl("  mailto:buero@example.org  ") === "mailto:buero@example.org",
          activeUrlsBlocked: safeUrl("javascript:alert(1)") === "#"
            && safeUrl("data:text/html;base64,AAAA") === "#"
            && safeUrl("vbscript:msgbox") === "#",
          activeMarkupRemoved: !/<script|<\/script|<iframe|onclick|onerror|javascript:/i.test(stripped),
          textPreserved: stripped.includes("Hallo") && stripped.includes("Klick") && stripped.includes('<a href="#">'),
          harmlessMarkupPreserved: sanitizeEmailHtml('<p class="x">Hallo <strong>Welt</strong></p>') === '<p class="x">Hallo <strong>Welt</strong></p>',
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Unbekannte Texte werden maskiert; Skripte, Frames, Handler und aktive URLs verschwinden aus dem E-Mail-HTML.",
          details: checks,
        };
      },
    },
  ],
};

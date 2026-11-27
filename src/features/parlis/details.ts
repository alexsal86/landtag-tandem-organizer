/**
 * Detaildaten eines parlamentarischen Vorgangs.
 *
 * Der Volltext liegt bewusst nicht in der Datenbank, sondern als JSON je
 * Vorgang neben der App (public/parlis/<vorgangs_id>.json). Die Liste lädt nur
 * Metadaten; Frage, Begründung, Antwort und Unterzeichner kommen erst beim
 * Öffnen eines Vorgangs dazu. Damit bleiben Listenabfragen klein und der
 * Volltext wird über den CDN-Cache ausgeliefert.
 */

export interface DocumentAnswer {
  signatory: string;
  role: string;
  letterDate: string;
  fileReference: string;
  coMinistries: string[];
  references: string[];
  mode: string;
}

export interface DocumentDetails {
  vorgangsId: string;
  drucksache: string;
  vorgangstyp: string;
  titel: string;
  eingegangen: string;
  ausgegeben: string;
  signers: string[];
  signerParty: string;
  wholeFaction: boolean;
  signersRaw: string;
  signerResolution: string;
  answer: DocumentAnswer;
  questionCount: number;
  questionText: string;
  reasoningText: string;
  answerText: string;
  rotatedPages: number[];
  pdfUrl: string;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const numbers = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === "number") : [];

export function parseDocumentDetails(raw: unknown): DocumentDetails | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const vorgangsId = text(data.vorgangsId);
  if (!vorgangsId) return null;
  const answer = (data.answer && typeof data.answer === "object" ? data.answer : {}) as Record<string, unknown>;
  return {
    vorgangsId,
    drucksache: text(data.drucksache),
    vorgangstyp: text(data.vorgangstyp),
    titel: text(data.titel),
    eingegangen: text(data.eingegangen),
    ausgegeben: text(data.ausgegeben),
    signers: strings(data.signers),
    signerParty: text(data.signerParty),
    wholeFaction: data.wholeFaction === true,
    signersRaw: text(data.signersRaw),
    signerResolution: text(data.signerResolution),
    answer: {
      signatory: text(answer.signatory),
      role: text(answer.role),
      letterDate: text(answer.letterDate),
      fileReference: text(answer.fileReference),
      coMinistries: strings(answer.coMinistries),
      references: strings(answer.references),
      mode: text(answer.mode),
    },
    questionCount: typeof data.questionCount === "number" ? data.questionCount : 0,
    questionText: text(data.questionText),
    reasoningText: text(data.reasoningText),
    answerText: text(data.answerText),
    rotatedPages: numbers(data.rotatedPages),
    pdfUrl: text(data.pdfUrl),
  };
}

/** Unterzeichnerzeile: Namen, Fraktion und Hinweis auf die gesamte Fraktion. */
export function signerSummary(details: DocumentDetails): string {
  const names = details.signers.join(", ");
  const notes = [details.signerParty, details.wholeFaction ? "gesamte Fraktion" : ""]
    .filter(Boolean)
    .join(", ");
  if (!names) return details.wholeFaction ? "Gesamte Fraktion" : "";
  return notes ? `${names} (${notes})` : names;
}

export function documentDetailsUrl(vorgangsId: string): string {
  // BASE_URL ohne vite/client-Typen: die enge Typisierung hält den Import lokal.
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  return `${base}parlis/${encodeURIComponent(vorgangsId)}.json`;
}

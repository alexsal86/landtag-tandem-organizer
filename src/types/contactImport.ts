export type SpreadsheetCell = string | number | boolean | Date | null | undefined;
export type SpreadsheetRow = SpreadsheetCell[];

export interface VCardValueLike {
  valueOf: () => unknown;
  type?: string | string[];
}

export interface ParsedVCard {
  fn?: VCardValueLike;
  n?: VCardValueLike;
  org?: VCardValueLike;
  title?: VCardValueLike;
  email?: VCardValueLike | VCardValueLike[];
  tel?: VCardValueLike | VCardValueLike[];
  adr?: VCardValueLike | VCardValueLike[];
  url?: VCardValueLike;
  note?: VCardValueLike;
}

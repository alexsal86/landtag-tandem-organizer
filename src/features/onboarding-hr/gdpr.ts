import declaration from "./gdprDeclaration.json";
export const GDPR_DECLARATION = declaration;
export interface GdprDeclaration { version: string; text: string }
export const DEFAULT_GDPR_DECLARATION: GdprDeclaration = {
  version: declaration.version,
  text: declaration.title + "\n\n" + declaration.sections.map(s => s.title + "\n" + s.text).join("\n\n"),
};
export const isValidDeclaration = (text: string) => text.trim().length >= 100 && text.length <= 50000;
export const hasReadToEnd = (top: number, height: number, total: number) =>
  height > 0 && top + height >= total - 2;
export const canConfirmGdpr = (actor: string | undefined, employee: string, read: boolean) =>
  !!actor && actor === employee && read;

/**
 * Palette token helpers — replace legacy `bg-blue-500` etc. with semantic palette tokens.
 * Helpers return literal class strings so Tailwind's scanner can detect them.
 *
 * Legacy DB values like 'bg-blue-500' are mapped to palette keys; new tokens
 * resolve via tailwind.config palette.* + index.css --palette-* HSL variables.
 */

export type PaletteKey =
  | "red" | "orange" | "amber" | "yellow" | "lime" | "green"
  | "teal" | "cyan" | "blue" | "indigo" | "purple" | "violet"
  | "pink" | "rose" | "gray";

const LEGACY_TO_KEY: Record<string, PaletteKey> = {
  "bg-red-500": "red",
  "bg-orange-500": "orange",
  "bg-amber-500": "amber",
  "bg-yellow-500": "yellow",
  "bg-lime-500": "lime",
  "bg-green-500": "green",
  "bg-teal-500": "teal",
  "bg-cyan-500": "cyan",
  "bg-blue-500": "blue",
  "bg-indigo-500": "indigo",
  "bg-purple-500": "purple",
  "bg-violet-500": "violet",
  "bg-pink-500": "pink",
  "bg-rose-500": "rose",
  "bg-muted-foreground": "gray",
  "bg-gray-500": "gray",
};

export const normalizePaletteKey = (raw: string | null | undefined): PaletteKey => {
  if (!raw) return "blue";
  if (LEGACY_TO_KEY[raw]) return LEGACY_TO_KEY[raw];
  // strip prefixes if user passed token form
  const simple = raw.replace(/^(bg-|text-|border-)?(palette-)?/, "") as PaletteKey;
  return (LEGACY_TO_KEY[`bg-${simple}-500`] || (simple in PALETTE_SOLID ? simple as PaletteKey : "blue")) as PaletteKey;
};

/** Solid background dot/swatch */
export const PALETTE_SOLID: Record<PaletteKey, string> = {
  red: "bg-palette-red",
  orange: "bg-palette-orange",
  amber: "bg-palette-amber",
  yellow: "bg-palette-yellow",
  lime: "bg-palette-lime",
  green: "bg-palette-green",
  teal: "bg-palette-teal",
  cyan: "bg-palette-cyan",
  blue: "bg-palette-blue",
  indigo: "bg-palette-indigo",
  purple: "bg-palette-purple",
  violet: "bg-palette-violet",
  pink: "bg-palette-pink",
  rose: "bg-palette-rose",
  gray: "bg-palette-gray",
};

/** Soft block (bg/20 + border + text) — used for Letter designer blocks */
export const PALETTE_SOFT: Record<PaletteKey, string> = {
  red: "bg-palette-red/20 border-palette-red text-palette-red",
  orange: "bg-palette-orange/20 border-palette-orange text-palette-orange",
  amber: "bg-palette-amber/20 border-palette-amber text-palette-amber",
  yellow: "bg-palette-yellow/20 border-palette-yellow text-palette-yellow",
  lime: "bg-palette-lime/20 border-palette-lime text-palette-lime",
  green: "bg-palette-green/20 border-palette-green text-palette-green",
  teal: "bg-palette-teal/20 border-palette-teal text-palette-teal",
  cyan: "bg-palette-cyan/20 border-palette-cyan text-palette-cyan",
  blue: "bg-palette-blue/20 border-palette-blue text-palette-blue",
  indigo: "bg-palette-indigo/20 border-palette-indigo text-palette-indigo",
  purple: "bg-palette-purple/20 border-palette-purple text-palette-purple",
  violet: "bg-palette-violet/20 border-palette-violet text-palette-violet",
  pink: "bg-palette-pink/20 border-palette-pink text-palette-pink",
  rose: "bg-palette-rose/20 border-palette-rose text-palette-rose",
  gray: "bg-palette-gray/20 border-palette-gray text-palette-gray",
};

/** Soft prompt container: subtle bg + border + accent */
export const PALETTE_PROMPT: Record<PaletteKey, { container: string; icon: string; submitButton: string }> = {
  red:    { container: "border-palette-red/40 bg-palette-red/10",       icon: "text-palette-red",    submitButton: "bg-palette-red hover:bg-palette-red/90 text-white" },
  orange: { container: "border-palette-orange/40 bg-palette-orange/10", icon: "text-palette-orange", submitButton: "bg-palette-orange hover:bg-palette-orange/90 text-white" },
  amber:  { container: "border-palette-amber/40 bg-palette-amber/10",   icon: "text-palette-amber",  submitButton: "bg-palette-amber hover:bg-palette-amber/90 text-foreground" },
  yellow: { container: "border-palette-yellow/40 bg-palette-yellow/10", icon: "text-palette-yellow", submitButton: "bg-palette-yellow hover:bg-palette-yellow/90 text-foreground" },
  lime:   { container: "border-palette-lime/40 bg-palette-lime/10",     icon: "text-palette-lime",   submitButton: "bg-palette-lime hover:bg-palette-lime/90 text-foreground" },
  green:  { container: "border-palette-green/40 bg-palette-green/10",   icon: "text-palette-green",  submitButton: "bg-palette-green hover:bg-palette-green/90 text-white" },
  teal:   { container: "border-palette-teal/40 bg-palette-teal/10",     icon: "text-palette-teal",   submitButton: "bg-palette-teal hover:bg-palette-teal/90 text-white" },
  cyan:   { container: "border-palette-cyan/40 bg-palette-cyan/10",     icon: "text-palette-cyan",   submitButton: "bg-palette-cyan hover:bg-palette-cyan/90 text-white" },
  blue:   { container: "border-palette-blue/40 bg-palette-blue/10",     icon: "text-palette-blue",   submitButton: "bg-palette-blue hover:bg-palette-blue/90 text-white" },
  indigo: { container: "border-palette-indigo/40 bg-palette-indigo/10", icon: "text-palette-indigo", submitButton: "bg-palette-indigo hover:bg-palette-indigo/90 text-white" },
  purple: { container: "border-palette-purple/40 bg-palette-purple/10", icon: "text-palette-purple", submitButton: "bg-palette-purple hover:bg-palette-purple/90 text-white" },
  violet: { container: "border-palette-violet/40 bg-palette-violet/10", icon: "text-palette-violet", submitButton: "bg-palette-violet hover:bg-palette-violet/90 text-white" },
  pink:   { container: "border-palette-pink/40 bg-palette-pink/10",     icon: "text-palette-pink",   submitButton: "bg-palette-pink hover:bg-palette-pink/90 text-white" },
  rose:   { container: "border-palette-rose/40 bg-palette-rose/10",     icon: "text-palette-rose",   submitButton: "bg-palette-rose hover:bg-palette-rose/90 text-white" },
  gray:   { container: "border-palette-gray/40 bg-palette-gray/10",     icon: "text-palette-gray",   submitButton: "bg-palette-gray hover:bg-palette-gray/90 text-white" },
};

export const getPaletteSolidClass = (raw: string | null | undefined) => PALETTE_SOLID[normalizePaletteKey(raw)];
export const getPaletteSoftClass = (raw: string | null | undefined) => PALETTE_SOFT[normalizePaletteKey(raw)];
export const getPalettePromptClasses = (raw: string | null | undefined) => PALETTE_PROMPT[normalizePaletteKey(raw)];

/** Color preset list for pickers (label + token key + sample class for the swatch) */
export const PALETTE_PRESETS: Array<{ key: PaletteKey; label: string; legacyValue: string; swatch: string }> = [
  { key: "blue",   label: "Blau",   legacyValue: "bg-blue-500",   swatch: "bg-palette-blue" },
  { key: "indigo", label: "Indigo", legacyValue: "bg-indigo-500", swatch: "bg-palette-indigo" },
  { key: "purple", label: "Lila",   legacyValue: "bg-purple-500", swatch: "bg-palette-purple" },
  { key: "pink",   label: "Pink",   legacyValue: "bg-pink-500",   swatch: "bg-palette-pink" },
  { key: "rose",   label: "Rose",   legacyValue: "bg-rose-500",   swatch: "bg-palette-rose" },
  { key: "red",    label: "Rot",    legacyValue: "bg-red-500",    swatch: "bg-palette-red" },
  { key: "orange", label: "Orange", legacyValue: "bg-orange-500", swatch: "bg-palette-orange" },
  { key: "amber",  label: "Amber",  legacyValue: "bg-amber-500",  swatch: "bg-palette-amber" },
  { key: "yellow", label: "Gelb",   legacyValue: "bg-yellow-500", swatch: "bg-palette-yellow" },
  { key: "lime",   label: "Lime",   legacyValue: "bg-lime-500",   swatch: "bg-palette-lime" },
  { key: "green",  label: "Grün",   legacyValue: "bg-green-500",  swatch: "bg-palette-green" },
  { key: "teal",   label: "Teal",   legacyValue: "bg-teal-500",   swatch: "bg-palette-teal" },
  { key: "cyan",   label: "Cyan",   legacyValue: "bg-cyan-500",   swatch: "bg-palette-cyan" },
  { key: "gray",   label: "Grau",   legacyValue: "bg-muted-foreground", swatch: "bg-palette-gray" },
];

/** Priority tokens for tasks */
export const PRIORITY_STYLES = {
  high:   { dot: "bg-priority-high",   text: "text-priority-high",   border: "border-priority-high/40",   bgLight: "bg-priority-high/10",   label: "Hoch" },
  medium: { dot: "bg-priority-medium", text: "text-priority-medium", border: "border-priority-medium/40", bgLight: "bg-priority-medium/10", label: "Mittel" },
  low:    { dot: "bg-priority-low",    text: "text-priority-low",    border: "border-priority-low/40",    bgLight: "bg-priority-low/10",    label: "Niedrig" },
} as const;

export const STATUS_STYLES = {
  todo:          { dot: "bg-muted-foreground", text: "text-muted-foreground", border: "border-border",          bgLight: "bg-muted/40",         label: "Offen" },
  "in-progress": { dot: "bg-palette-blue",     text: "text-palette-blue",     border: "border-palette-blue/40", bgLight: "bg-palette-blue/10",  label: "In Arbeit" },
  completed:    { dot: "bg-priority-low",     text: "text-priority-low",     border: "border-priority-low/40", bgLight: "bg-priority-low/10",  label: "Erledigt" },
} as const;

export const STATUS_FALLBACK = {
  dot: "bg-palette-amber", text: "text-palette-amber", border: "border-palette-amber/40", bgLight: "bg-palette-amber/10",
} as const;

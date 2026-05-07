// Deterministic pastel color palette for contact avatar fallbacks.
// Picks based on a stable seed (id or name) so the same contact always
// renders the same color, but the list overall feels varied.

const PALETTE = [
  "bg-palette-rose/20 text-palette-rose",
  "bg-palette-pink/20 text-palette-pink",
  "bg-palette-pink/20 text-palette-pink",
  "bg-palette-purple/20 text-palette-purple",
  "bg-palette-violet/20 text-palette-violet",
  "bg-palette-indigo/20 text-palette-indigo",
  "bg-palette-blue/20 text-palette-blue",
  "bg-palette-blue/20 text-palette-blue",
  "bg-palette-cyan/20 text-palette-cyan",
  "bg-palette-teal/20 text-palette-teal",
  "bg-palette-green/20 text-palette-green",
  "bg-palette-green/20 text-palette-green",
  "bg-palette-lime/20 text-palette-lime",
  "bg-palette-amber/20 text-palette-amber",
  "bg-palette-orange/20 text-palette-orange",
];

export function getContactAvatarColor(seed?: string | null): string {
  if (!seed) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

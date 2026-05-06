// Deterministic pastel color palette for contact avatar fallbacks.
// Picks based on a stable seed (id or name) so the same contact always
// renders the same color, but the list overall feels varied.

const PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-pink-100 text-pink-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-purple-100 text-purple-700",
  "bg-violet-100 text-violet-700",
  "bg-indigo-100 text-indigo-700",
  "bg-blue-100 text-blue-700",
  "bg-sky-100 text-sky-700",
  "bg-cyan-100 text-cyan-700",
  "bg-teal-100 text-teal-700",
  "bg-emerald-100 text-emerald-700",
  "bg-green-100 text-green-700",
  "bg-lime-100 text-lime-700",
  "bg-amber-100 text-amber-700",
  "bg-orange-100 text-orange-700",
];

export function getContactAvatarColor(seed?: string | null): string {
  if (!seed) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

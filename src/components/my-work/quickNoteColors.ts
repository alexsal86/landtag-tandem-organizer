// Stored note colors (persisted as hex in quick_notes.color).
export const QUICK_NOTE_COLORS = [
  { name: "Standard", value: "#3b82f6" },
  { name: "Gelb", value: "#f59e0b" },
  { name: "Grün", value: "#10b981" },
  { name: "Blau", value: "#06b6d4" },
  { name: "Rosa", value: "#f472b6" },
  { name: "Lila", value: "#8b5cf6" },
];

export function getNoteColorText(color: string): string {
  const shortHex = /^#([\da-f])([\da-f])([\da-f])$/i;
  const hex = color.replace(shortHex, "#$1$1$2$2$3$3");
  if (!/^#[\da-f]{6}$/i.test(hex)) return "#000";

  const toLinear = (offset: number) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * toLinear(1) + 0.7152 * toLinear(3) + 0.0722 * toLinear(5);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast > blackContrast ? "#fff" : "#000";
}

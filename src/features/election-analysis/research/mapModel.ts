/** Symmetric diverging scale. A missing result is never a measured zero. */
export function signedColor(value: number | null, max: number): string {
  if (value === null) return "#c3c7bc";
  const strength = Math.min(1, Math.abs(value) / Math.max(1, max));
  const from = [240, 241, 235],
    to = value < 0 ? [194, 107, 40] : [37, 99, 166];
  return (
    "#" +
    from
      .map((channel, index) =>
        Math.round(channel + (to[index] - channel) * strength)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

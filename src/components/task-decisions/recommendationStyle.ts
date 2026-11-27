import type { CSSProperties } from "react";

type RecommendationStyle = CSSProperties & {
  "--recommendation-background": string;
  "--recommendation-text": string;
  "--recommendation-border": string;
};

const greenRecommendation: RecommendationStyle = {
  "--recommendation-background": "#eaf5df",
  "--recommendation-text": "#397d16",
  "--recommendation-border": "#55ad21",
};

const darkTextByColor = new Map([
  ["red", "#b91c1c"],
  ["orange", "#c2410c"],
  ["yellow", "#a16207"],
  ["blue", "#1d4ed8"],
  ["purple", "#7e22ce"],
  ["lime", "#4d7c0f"],
  ["gray", "#374151"],
]);

export function getDecisionRecommendationStyle(color?: string): RecommendationStyle {
  const text = color ? darkTextByColor.get(color) : undefined;
  if (!text) return greenRecommendation;

  return {
    "--recommendation-background": `hsl(var(--palette-${color}) / 0.1)`,
    "--recommendation-text": text,
    "--recommendation-border": text,
  };
}

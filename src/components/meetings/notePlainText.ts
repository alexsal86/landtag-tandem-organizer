import { stripHtml } from "@/utils/textDiff";

/** Note titles may contain rich HTML or escaped rich HTML from older editors. */
export function notePlainText(value: string) {
  let text = value;
  for (let pass = 0; pass < 3; pass++) {
    const cleaned = stripHtml(text);
    if (cleaned === text) break;
    text = cleaned;
  }
  return text;
}

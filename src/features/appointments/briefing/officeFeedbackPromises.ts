const explicitPromise = /\b(?:ich|wir)\s+(?:haben?|hatten?)\b.*\b(?:zugesagt|versprochen)\b/i;
const futurePromise = /\b(?:ich\s+werde|wir\s+werden)\s+\S/i;
const negation = /\b(?:nicht|nie|nichts|keinerlei|kein(?:e|en|em|er|es)?)\b/i;

export const officeFeedbackPromiseMaxLength = 1000;

export function suggestOfficeFeedbackPromises(text: string): string {
  const suggestions = new Set<string>();
  // Keep decimal numbers and dates such as 12.12. together.
  for (const part of text.split(/\n+|(?<=[!?])\s+|(?<!\d\.)(?<=\.)\s+/u)) {
    const sentence = part.trim();
    if (sentence.endsWith("?") || negation.test(sentence)) continue;
    const labelledPromise = sentence.match(/^zusagen?\s*:\s*(.+)/i)?.[1]?.trim();
    if (labelledPromise) suggestions.add(labelledPromise);
    else if (explicitPromise.test(sentence) || futurePromise.test(sentence)) suggestions.add(sentence);
  }
  return [...suggestions].join("\n").slice(0, officeFeedbackPromiseMaxLength);
}

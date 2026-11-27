const maxLength = 1000;

export const officeFeedbackPromiseMaxLength = maxLength;

const negation = /\b(?:nicht|nie|niemals|nichts|kein(?:e|en|em|er|es)?|keinerlei|niemand)\b/i;
/** Formulierungen, die verneinend aussehen, aber eine Zusage nicht aufheben. */
const harmlessNegation = /\b(?:nicht\s+nur|nicht\s+allein|nicht\s+zuletzt|kein\s+problem|keine\s+sorge|kein\s+thema|nicht\s+schlimm)\b/gi;

/**
 * Wörter, nach denen „ich/wir“ den laufenden Satzteil fortsetzt statt einen neuen zu beginnen.
 * Nach „und/aber/sondern“ beginnt dagegen ein neuer Teilsatz.
 * Nur Einträge aufnehmen, deren Verhalten ein Test in officeFeedbackPromises.test.ts absichert.
 */
const bindingWords = new Set(["als", "damit", "dass", "ob", "obwohl", "sobald", "weil", "wenn"]);

/**
 * Kürzel, nach denen kein Satz endet. „z“ und „b“ stehen für „z. B.“, „d“ und „h“ für „d. h.“.
 * Datumsangaben deckt zusätzlich die Ziffernregel in splitSentences ab.
 * Nur Einträge aufnehmen, deren Verhalten ein Test in officeFeedbackPromises.test.ts absichert.
 */
const abbreviations = new Set(["b", "d", "dr", "h", "z"]);

/** Ausdrückliche Zusage-Marker; eingebettete Verneinung im Inhalt hebt die Zusage nicht auf. */
const explicitPatterns: RegExp[] = [
  /\b(?:ich|wir)\s+(?:habe|haben|hatte|hatten)\b[^.!?;]{0,60}?\b(?:zugesagt|versprochen)\b/i,
  /\b(?:ich|wir)\s+(?:sage|sagen|sagte|sagten|sichere|sichern)\s+zu\b/i,
  /\b(?:ich|wir)\s+(?:verspreche|versprechen|versprach|versprachen)\b/i,
  /\b(?:ich|wir)\s+(?:habe|haben|hatte|hatten)\s+(?:mich|uns)\s+verpflichtet\b/i,
];

const futurePromiseVerb = "melden|schicken|senden|zurückrufen|zurückmelden|kümmern|nachhaken|nachfragen|einladen"
  + "|informieren|besorgen|prüfen|klären|erledigen|weiterleiten|anrufen|kontaktieren|organisieren|vorbereiten"
  + "|abstimmen|übernehmen|einreichen|besprechen";

/**
 * Zusagen ohne die Wörter „zugesagt/versprochen“. „ich werde gefragt/informiert“ ist Passiv
 * und trifft bewusst nicht, weil dort kein Infinitiv aus der Handlungsliste folgt.
 */
const implicitPatterns: RegExp[] = [
  /\b(?:ich|wir)\s+(?:werde|werden)\b[^.!?;]{0,40}?\b(?:mich|uns)\b/i,
  // Kein Sprung über „ob/dass/wenn …“ oder einen neuen Handelnden, sonst würde
  // „ich werde gefragt, ob ich die Unterlagen schicken kann“ zur Zusage.
  new RegExp(`\\b(?:ich|wir)\\s+(?:werde|werden)\\s+(?:(?!(?:ob|dass|wenn|weil|als|ich|wir|man)\\b)[^\\s,;]+\\s+){0,6}?(?:${futurePromiseVerb})\\b`, "i"),
  /\b(?:ich|wir)\s+(?:kümmere|kümmern)\s+(?:mich|uns)\b/i,
  /\b(?:ich|wir)\s+(?:schicke|schicken|sende|senden)\b/i,
  /\b(?:ich|wir)\s+(?:melde|melden)\s+(?:mich|uns)\b/i,
  /\b(?:ich|wir)\s+(?:rufe|rufen|anrufe|anrufen)\b[^.!?;]{0,40}?\b(?:zurück|an)\b/i,
  /\b(?:ich|wir)\s+(?:hake|haken)\b[^.!?;]{0,20}?\bnach\b/i,
  /\b(?:ich|wir)\s+(?:frage|fragen)\b[^.!?;]{0,30}?\bnach\b/i,
  /\b(?:ich|wir)\s+(?:lade|laden)\b[^.!?;]{0,40}?\bein\b/i,
  /\b(?:ich|wir)\s+(?:prüfe|prüfen|kläre|klären|informiere|informieren|besorge|besorgen|erledige|erledigen|kontaktiere|kontaktieren|organisiere|organisieren|übernehme|übernehmen|leite|leiten|vorbereite|vorbereiten|bespreche|besprechen)\b/i,
  /\b(?:ich|wir)\s+(?:nehme|nehmen)\b[^.!?;]{0,30}?\b(?:kontakt|verbindung)\b[^.!?;]{0,40}?\bauf\b/i,
];

/**
 * Unpersönliches Passiv kann eine Zusage sein („Die Unterlagen werden bis Freitag geschickt“),
 * während „ich werde gefragt“ nur berichtet, dass jemand fragt. Gewertet wird deshalb nur die
 * werden-Passivform mit einer Zusage-Handlung, wenn nicht ich/wir die Betroffenen sind.
 */
const passivePromisePattern = /\b(?:wird|werden)\b[^\n]{0,60}?\b(?:geschickt|gesendet|geprüft|geklärt|erledigt|nachgefragt|nachgehakt|informiert|eingeladen|zurückgerufen|besorgt|vorbereitet|übernommen|weitergeleitet|kontaktiert|organisiert|gemeldet|eingereicht|abgestimmt)\b/i;

function hasNegation(text: string): boolean {
  return negation.test(text.replace(harmlessNegation, " "));
}

function isNegatedInClausePart(clause: string, matchEnd: number): boolean {
  const comma = clause.indexOf(",", matchEnd);
  return hasNegation(comma === -1 ? clause : clause.slice(0, comma));
}

function isPassivePromise(clause: string): boolean {
  const match = passivePromisePattern.exec(clause);
  if (!match) return false;
  const subject = clause.slice(0, match.index ?? 0).trimEnd();
  // „Wir werden morgen informiert“ beschreibt, dass wir informiert werden – keine eigene Zusage.
  if (/\b(?:ich|wir|mich|uns)$/i.test(subject)) return false;
  return !isNegatedInClausePart(clause, (match.index ?? 0) + match[0].length);
}

interface Sentence {
  text: string;
  question: boolean;
}

/** Teilt Text in Sätze; Diktat ohne Satzzeichen bleibt ein Satz und wird danach in Teilsätze geteilt. */
function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n" || char === ";") {
      const value = text.slice(start, index).trim();
      if (value) sentences.push({ text: value, question: false });
      start = index + 1;
      continue;
    }
    if (char !== "." && char !== "!" && char !== "?") continue;
    if (char === ".") {
      const previous = text[index - 1] ?? "";
      const next = text[index + 1] ?? "";
      // 12.12. oder 1.000 bleiben zusammen.
      if (/\d/.test(previous) || /\d/.test(next)) continue;
      const word = (text.slice(start, index).match(/[\p{L}]+$/u)?.[0] ?? "").toLowerCase();
      if (abbreviations.has(word)) continue;
    }
    const value = text.slice(start, index + 1).trim();
    if (value) sentences.push({ text: value, question: char === "?" });
    start = index + 1;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push({ text: rest, question: false });
  return sentences;
}

/**
 * Teilt einen Satz an „ich/wir“ in Teilsätze, damit eine Verneinung im Folgesatz die Zusage
 * nicht verwirft. Nach „dass/weil/ob …“ gehört „ich“ weiter zum laufenden Teilsatz.
 */
function splitClauses(sentence: string): string[] {
  const clauses: string[] = [];
  const subject = /(?:^|[\s,;])(?:ich|wir)\b/gi;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = subject.exec(sentence)) !== null) {
    const pronoun = match.index + match[0].length - 3;
    if (pronoun <= start) continue;
    const head = sentence.slice(start, pronoun);
    const previousWord = (head.match(/([\p{L}]+)\s*$/u)?.[1] ?? "").toLowerCase();
    if (bindingWords.has(previousWord)) continue;
    // „… zu schicken aber ich …“: das Bindewort gehört nicht mehr zum Zusage-Teilsatz.
    const connector = head.match(/[\s,](?:und|aber|oder|sondern|denn|doch|also|dann|danach|anschließend|außerdem|zudem|trotzdem|allerdings|jedoch|deshalb)\s*$/i);
    clauses.push(sentence.slice(start, connector ? start + (connector.index ?? 0) : pronoun));
    start = pronoun;
  }
  clauses.push(sentence.slice(start));
  return clauses.map(clause => clause.trim()).filter(Boolean);
}

function evaluateClause(clause: string): boolean {
  for (const pattern of explicitPatterns) {
    const match = pattern.exec(clause);
    if (!match) continue;
    // Nur eine Verneinung direkt am Marker („nicht/nichts zugesagt“) hebt die Zusage auf.
    const before = clause.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
    return !hasNegation(before + " " + match[0]);
  }
  for (const pattern of implicitPatterns) {
    const match = pattern.exec(clause);
    if (!match) continue;
    // Verneinungen in einem folgenden Nebensatz („…, die sich nicht gemeldet hat“) zählen nicht.
    return !isNegatedInClausePart(clause, (match.index ?? 0) + match[0].length);
  }
  return isPassivePromise(clause);
}

export function suggestOfficeFeedbackPromises(text: string): string {
  const suggestions = new Set<string>();
  for (const sentence of splitSentences(text)) {
    for (const clause of splitClauses(sentence.text)) {
      const labelled = clause.match(/^zusagen?\s*:\s*(.+)$/i)?.[1]?.trim();
      if (labelled) {
        suggestions.add(labelled);
        continue;
      }
      // Fragen sind keine Zusagen, außer der Satz sagt ausdrücklich „ich habe zugesagt“.
      if (sentence.question && !explicitPatterns.some(pattern => pattern.test(clause))) continue;
      if (evaluateClause(clause)) suggestions.add(clause);
    }
  }
  return [...suggestions].join("\n").slice(0, maxLength);
}

/**
 * Übernimmt einen direkt nach dem Diktat erkannten Vorschlag in das Zusagenfeld – aber nur,
 * solange die Zusage nicht schon von Hand bearbeitet wurde.
 */
export function mergeDetectedPromise(
  current: { hasPromise: boolean; text?: string } | undefined,
  detected: string | undefined,
  suggestion: string,
): { hasPromise: boolean; text?: string } {
  if (current?.text?.trim() && current.text !== detected) return current;
  return { hasPromise: true, text: suggestion };
}

export function officeDebriefPromiseEdit(hasPromise: boolean, text: string, due: string) {
  const promise = hasPromise ? text.trim() : "";
  return {
    _promise: promise || undefined,
    _due: promise && due ? due : undefined,
  };
}

export const OPEN_KNOWLEDGE_QUESTION = "openKnowledgeQuestion";
export const KNOWLEDGE_QUESTION_SHORTCUT = "Strg/⌘ + Alt/⌥ + F";

export function openKnowledgeQuestion(title = "") {
  window.dispatchEvent(
    new CustomEvent<string>(OPEN_KNOWLEDGE_QUESTION, { detail: title }),
  );
}

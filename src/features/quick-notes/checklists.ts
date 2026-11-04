/** Legacy text markers remain readable; new lists use Lexical's structured nodes. */
const markers = /\[( |x|X)\]/g;
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
type Item = { checked: boolean; element?: HTMLElement; text?: Text; offset?: number };
function items(document: Document): Item[] {
  const result: Item[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node instanceof HTMLElement && node.matches('li[role="checkbox"][aria-checked]')) {
      result.push({ checked: node.getAttribute("aria-checked") === "true", element: node });
    } else if (node instanceof Text && !node.parentElement?.closest('li[role="checkbox"], script, style')) {
      for (const match of node.data.matchAll(markers)) result.push({ checked: match[1] !== " ", text: node, offset: match.index });
    }
  }
  return result;
}
export function normalizeChecklistHtml(html: string) {
  const document = parse(html);
  for (const list of document.querySelectorAll('ul[data-note-checklist="true"], ul[__lexicallisttype="check"]')) {
    list.setAttribute("__lexicalListType", "check");
    list.setAttribute("data-note-checklist", "true");
  }
  for (const block of document.querySelectorAll("p, li")) {
    const match = block.textContent?.match(/^\s*\[( |x|X)\]\s*/);
    if (!match || block.closest('li[role="checkbox"]')) continue;
    let remaining = match[0].length;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while (remaining > 0 && (text = walker.nextNode())) {
      const size = Math.min(remaining, text.textContent?.length ?? 0);
      text.textContent = text.textContent?.slice(size) ?? "";
      remaining -= size;
    }
    const li = block.tagName === "LI" ? block : document.createElement("li");
    if (li !== block) li.append(...Array.from(block.childNodes));
    li.setAttribute("role", "checkbox"); li.setAttribute("aria-checked", String(match[1] !== " "));
    let list = block.tagName === "LI" && block.parentElement?.tagName === "UL" ? block.parentElement : null;
    if (!list) {
      list = document.createElement("ul");
      block.replaceWith(list); list.append(li);
    }
    list.setAttribute("__lexicalListType", "check"); list.setAttribute("data-note-checklist", "true");
    for (const child of list.children) {
      child.setAttribute("role", "checkbox");
      if (!child.hasAttribute("aria-checked")) child.setAttribute("aria-checked", "false");
    }
  }
  return document.body.innerHTML;
}
export function exportChecklistHtml(html: string) {
  const document = parse(html);
  for (const list of document.querySelectorAll('ul[__lexicallisttype="check"]')) list.setAttribute("data-note-checklist", "true");
  return document.body.innerHTML;
}
export function countChecklist(content: string) {
  const list = items(parse(content));
  return { done: list.filter(item => item.checked).length, total: list.length };
}
export function toggleChecklistItem(content: string, index: number) {
  const document = parse(content);
  const item = items(document)[index];
  if (!item) return content;
  if (item.element) item.element.setAttribute("aria-checked", String(!item.checked));
  else if (item.text && item.offset !== undefined) {
    item.text.replaceData(item.offset, 3, item.checked ? "[ ]" : "[x]");
  }
  return document.body.innerHTML;
}
export function renderChecklistHtml(sanitizedHtml: string, editable = true) {
  const document = parse(sanitizedHtml);
  const list = items(document);
  // Text offsets must be replaced right-to-left to retain earlier positions.
  for (let index = list.length - 1; index >= 0; index--) {
    const item = list[index];
    const button = document.createElement("button");
    button.type = "button"; button.dataset.checkIndex = String(index);
    button.setAttribute("role", "checkbox"); button.setAttribute("aria-checked", String(item.checked));
    button.setAttribute("aria-label", item.checked ? "Erledigt" : "Offen");
    button.disabled = !editable;
    button.className = `note-check${item.checked ? " note-check--done" : ""}`;
    button.textContent = item.checked ? "✓" : "";
    if (item.element) {
      item.element.removeAttribute("role"); item.element.removeAttribute("aria-checked");
      item.element.classList.remove("note-editor-check", "note-editor-check--done");
      item.element.classList.toggle("note-check-item--done", item.checked);
      item.element.prepend(button);
      item.element.parentElement?.setAttribute("data-note-checklist", "true");
    } else if (item.text && item.offset !== undefined) {
      const tail = item.text.splitText(item.offset);
      tail.deleteData(0, 3); tail.before(button);
    }
  }
  return document.body.innerHTML;
}

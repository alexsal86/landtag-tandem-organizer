import React from "react";

/**
 * Bewusst kleiner Renderer für die Teilmenge, die `scripts/build-feature-catalog.mjs` erzeugt:
 * Überschriften (#, ##, ###), Absätze, Listen, Tabellen, `code`, **fett** und Links.
 * Kein HTML aus der Datei, keine Erweiterbarkeit für fremde Markdown-Features.
 */
interface MarkdownViewProps {
  markdown: string;
  onNavigatePage?: (id: string) => void;
}

function renderInline(text: string, onNavigatePage?: (id: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] [overflow-wrap:anywhere]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const label = link?.[1] ?? token;
      const target = link?.[2] ?? "";
      const page = /^\.\/([\w-]+)\.md$/.exec(target);
      if (page && onNavigatePage) {
        nodes.push(
          <button
            key={key++}
            type="button"
            onClick={() => onNavigatePage(page[1])}
            className="font-medium text-primary underline underline-offset-2"
          >
            {label}
          </button>,
        );
      } else {
        // Repo-Dateien haben in der App keine Route; Pfad sichtbar machen statt ins Leere zu verlinken.
        nodes.push(
          <span key={key++} className="font-medium">
            {label} <span className="font-mono text-[0.85em] text-muted-foreground">({target})</span>
          </span>,
        );
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

const splitRow = (line: string) =>
  line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

const isSeparatorRow = (line: string) =>
  /^\|?[\s:-]+\|[\s|:-]*$/.test(line) && splitRow(line).every((cell) => /^:?-{2,}:?$/.test(cell));

export function MarkdownView({ markdown, onNavigatePage }: MarkdownViewProps) {
  const lines = markdown.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key++} className="mt-5 text-base font-semibold [overflow-wrap:anywhere]">{renderInline(line.slice(4), onNavigatePage)}</h3>);
      index++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={key++} className="mt-7 border-b pb-1 text-lg font-semibold [overflow-wrap:anywhere]">{renderInline(line.slice(3), onNavigatePage)}</h2>);
      index++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={key++} className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{renderInline(line.slice(2), onNavigatePage)}</h1>);
      index++;
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        if (!isSeparatorRow(lines[index])) rows.push(splitRow(lines[index]));
        index++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key++} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {(head ?? []).map((cell, cellIndex) => (
                  <th key={cellIndex} className="px-3 py-2 text-left font-medium [overflow-wrap:anywhere]">
                    {renderInline(cell, onNavigatePage)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top [overflow-wrap:anywhere]">
                      {renderInline(cell, onNavigatePage)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2));
        index++;
      }
      blocks.push(
        <ul key={key++} className="my-3 list-disc space-y-1 pl-6 text-sm">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="[overflow-wrap:anywhere]">{renderInline(item, onNavigatePage)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    blocks.push(<p key={key++} className="my-3 text-sm leading-relaxed [overflow-wrap:anywhere]">{renderInline(line, onNavigatePage)}</p>);
    index++;
  }

  return <div className="min-w-0 text-foreground">{blocks}</div>;
}

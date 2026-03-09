/**
 * Simple word-level diff algorithm for comparing two text strings.
 * Returns an array of diff segments with type: 'equal', 'added', or 'removed'.
 */

export interface DiffSegment {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

/**
 * Strips HTML tags and normalizes whitespace for clean text comparison.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Tokenizes text into words and whitespace for diffing.
 */
function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Longest Common Subsequence based diff.
 */
export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  // Build LCS table
  const m = oldTokens.length;
  const n = newTokens.length;

  // For large texts, fall back to a simpler approach
  if (m * n > 500_000) {
    return simpleDiff(oldText, newText);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffSegment[] = [];
  let i = m;
  let j = n;

  const segments: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      segments.push({ type: 'equal', value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      segments.push({ type: 'added', value: newTokens[j - 1] });
      j--;
    } else {
      segments.push({ type: 'removed', value: oldTokens[i - 1] });
      i--;
    }
  }

  segments.reverse();

  // Merge consecutive segments of same type
  for (const seg of segments) {
    const last = result[result.length - 1];
    if (last && last.type === seg.type) {
      last.value += seg.value;
    } else {
      result.push({ ...seg });
    }
  }

  return result;
}

/**
 * Simple line-by-line diff for very large texts.
 */
function simpleDiff(oldText: string, newText: string): DiffSegment[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffSegment[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      result.push({ type: 'equal', value: (oldLine ?? '') + '\n' });
    } else {
      if (oldLine !== undefined) {
        result.push({ type: 'removed', value: oldLine + '\n' });
      }
      if (newLine !== undefined) {
        result.push({ type: 'added', value: newLine + '\n' });
      }
    }
  }

  return result;
}

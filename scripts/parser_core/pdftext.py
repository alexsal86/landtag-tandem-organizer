import pdfplumber
from typing import List, Dict
from collections import Counter

def extract_pages(path) -> List[List[str]]:
    pages_lines = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            # Split by newline to list
            lines = [l.rstrip() for l in text.splitlines()]
            pages_lines.append(lines)
    return pages_lines

def remove_repeated_headers_footers(pages_lines: List[List[str]]) -> List[List[str]]:
    # Simple heuristic: collect first 3 lines + last 3 lines of each page
    first_candidates = Counter()
    last_candidates = Counter()
    for lines in pages_lines:
        for l in lines[:3]:
            first_candidates[l] += 1
        for l in lines[-3:]:
            last_candidates[l] += 1
    # Anything present in >= 70% of pages treat as header/footer
    header = {l for l, c in first_candidates.items() if c >= max(2, int(0.7 * len(pages_lines)))}
    footer = {l for l, c in last_candidates.items() if c >= max(2, int(0.7 * len(pages_lines)))}
    cleaned = []
    for lines in pages_lines:
        new = []
        for l in lines:
            if l in header or l in footer:
                continue
            # skip pure page numbers
            if l.strip().isdigit() and len(l.strip()) <= 3:
                continue
            new.append(l)
        cleaned.append(new)
    return cleaned

def flatten_pages(pages_lines: List[List[str]]) -> List[Dict]:
    """
    Returns list of dicts: {page, line, text}
    """
    out = []
    for p_idx, lines in enumerate(pages_lines, start=1):
        for line in lines:
            if line.strip():
                out.append({"page": p_idx, "text": line})
    return out

import pdfplumber
from typing import List, Dict
from collections import Counter

def extract_pages(path) -> List[List[str]]:
    """
    Alte einfache Extraktion (einspaltig).
    """
    pages_lines = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = [l.rstrip() for l in text.splitlines()]
            pages_lines.append(lines)
    return pages_lines

def remove_repeated_headers_footers(pages_lines: List[List[str]]) -> List[List[str]]:
    first_candidates = Counter()
    last_candidates = Counter()
    for lines in pages_lines:
        for l in lines[:3]:
            first_candidates[l] += 1
        for l in lines[-3:]:
            last_candidates[l] += 1
    header = {l for l, c in first_candidates.items() if c >= max(2, int(0.7 * len(pages_lines)))}
    footer = {l for l, c in last_candidates.items() if c >= max(2, int(0.7 * len(pages_lines)))}

    cleaned = []
    for lines in pages_lines:
        new = []
        for l in lines:
            if l in header or l in footer:
                continue
            if l.strip().isdigit() and len(l.strip()) <= 3:
                continue
            new.append(l)
        cleaned.append(new)
    return cleaned

def flatten_pages(pages_lines: List[List[str]]) -> List[Dict]:
    out = []
    for p_idx, lines in enumerate(pages_lines, start=1):
        for line in lines:
            if line.strip():
                out.append({"page": p_idx, "text": line})
    return out

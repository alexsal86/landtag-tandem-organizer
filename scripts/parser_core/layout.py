# Am Anfang vorhandene Importe beibehalten
from dataclasses import dataclass

@dataclass
class PageLayoutResult:
    lines: list
    method: str
    columns: int
    meta: dict | None = None   # <-- erweitern

def extract_pages_with_layout(pdf_path: str):
    """
    Sollte eine Liste von (Zeilenlisten) + Debug-Meta Liste liefern.
    Rückgabe: (pages_lines, debug_meta)
    """
    import pdfplumber, statistics
    pages_lines = []
    debug_meta = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            result = _extract_page_layout(page, i)
            pages_lines.append(result.lines)
            debug_meta.append({
                "page": i,
                "method": result.method,
                "columns": result.columns,
                **(result.meta or {})
            })
    return pages_lines, debug_meta

def _extract_page_layout(page, page_number: int):
    # Beispiel-Implementierung – ersetze durch deine vorhandene Logik
    try:
        words = page.extract_words(use_text_flow=True)
    except Exception as e:
        return PageLayoutResult(
            lines=[l for l in (page.extract_text() or "").splitlines() if l.strip()],
            method="fallback-error",
            columns=1,
            meta={"error": str(e)}
        )

    if len(words) < 40:
        # Einfach: keine Zwei-Spalten-Heuristik
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=[l for l in txt.splitlines() if l.strip()],
            method="single-pass",
            columns=1,
            meta={"words": len(words)}
        )

    # Spalten-Gap Heuristik
    mids = sorted(((w["x0"] + w["x1"]) / 2.0) for w in words)
    diffs = [mids[i]-mids[i-1] for i in range(1, len(mids))]
    if not diffs:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=[l for l in txt.splitlines() if l.strip()],
            method="no-diff",
            columns=1,
            meta={"words": len(words)}
        )
    largest = max(diffs)
    avg_rest = (sum(d for d in diffs if d != largest) / max(1, len(diffs)-1))
    two_col = largest > 25 and largest > avg_rest * 1.4

    if not two_col:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=[l for l in txt.splitlines() if l.strip()],
            method="single-heuristic",
            columns=1,
            meta={"words": len(words), "largest_gap": largest, "avg_other": avg_rest}
        )

    # Naive Split-Linie = Position der größten Lücke
    idx = diffs.index(largest) + 1
    split_x = (mids[idx-1] + mids[idx]) / 2.0

    left_words = [w for w in words if (w["x0"] + w["x1"]) / 2.0 < split_x]
    right_words = [w for w in words if w not in left_words]

    def to_lines(wlist):
        # sehr rudimentär; besser: Clustern nach y + sort
        lines_map = {}
        for w in wlist:
            ykey = round(w["top"]/3)  # Gruppierung grob
            lines_map.setdefault(ykey, []).append(w["text"])
        lines = []
        for y in sorted(lines_map.keys()):
            lines.append(" ".join(lines_map[y]))
        return lines

    left_lines = to_lines(left_words)
    right_lines = to_lines(right_words)
    merged = left_lines + right_lines  # linearisiert

    return PageLayoutResult(
        lines=[l for l in merged if l.strip()],
        method="two-column",
        columns=2,
        meta={
            "words": len(words),
            "largest_gap": largest,
            "avg_other": avg_rest,
            "split_x": split_x,
            "left_count": len(left_words),
            "right_count": len(right_words)
        }
    )

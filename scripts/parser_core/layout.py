import pdfplumber
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import math

@dataclass
class PageLayoutResult:
    lines: List[str]
    method: str
    columns: int
    meta: Dict[str, Any]

def extract_pages_with_layout(pdf_path: str,
                              force_two_column: bool = True,
                              min_words_for_detection: int = 30,
                              min_gap_abs: float = 40.0,
                              min_gap_rel: float = 0.18,
                              line_consistency_min: float = 0.45):
    """
    Liefert (pages_lines, debug_meta).
    force_two_column: Wenn True, versuchen wir IMMER zu splitten, es sei denn es fehlen harte Voraussetzungen.
    """
    pages_lines = []
    debug_meta = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            result = _process_page(
                page,
                page_index,
                force_two_column=force_two_column,
                min_words_for_detection=min_words_for_detection,
                min_gap_abs=min_gap_abs,
                min_gap_rel=min_gap_rel,
                line_consistency_min=line_consistency_min
            )
            pages_lines.append(result.lines)
            debug_meta.append({
                "page": page_index,
                "method": result.method,
                "columns": result.columns,
                **result.meta
            })
    return pages_lines, debug_meta

def _process_page(page,
                  page_number: int,
                  force_two_column: bool,
                  min_words_for_detection: int,
                  min_gap_abs: float,
                  min_gap_rel: float,
                  line_consistency_min: float) -> PageLayoutResult:
    try:
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    except Exception as e:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="fallback-extract-failed",
            columns=1,
            meta={"error": str(e)}
        )

    if not words:
        return PageLayoutResult(
            lines=[],
            method="empty-page",
            columns=1,
            meta={}
        )

    page_width = float(page.width or 0.0)
    if page_width <= 0:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="fallback-pagewidth-zero",
            columns=1,
            meta={"words": len(words)}
        )

    # Falls zu wenig Wörter und kein Force
    if len(words) < min_words_for_detection and not force_two_column:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="single-low-word-count",
            columns=1,
            meta={"words": len(words)}
        )

    mids = [( (w["x0"] + w["x1"]) / 2.0, w ) for w in words]
    mids_sorted = sorted(mids, key=lambda x: x[0])
    gaps: List[Tuple[float, float]] = []  # (gap_size, split_x)
    for i in range(1, len(mids_sorted)):
        left_mid = mids_sorted[i-1][0]
        right_mid = mids_sorted[i][0]
        gap = right_mid - left_mid
        split_x = (left_mid + right_mid) / 2.0
        gaps.append((gap, split_x))

    if not gaps:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="single-no-gaps",
            columns=1,
            meta={"words": len(words)}
        )

    # Größtes Gap
    gaps_sorted = sorted(gaps, key=lambda g: g[0], reverse=True)
    largest_gap, candidate_split = gaps_sorted[0]
    gap_rel = largest_gap / page_width if page_width else 0.0

    # Linke / rechte Wörter bestimmen
    left_words = [w for (mid, w) in mids_sorted if mid < candidate_split]
    right_words = [w for (mid, w) in mids_sorted if mid >= candidate_split]

    # Line consistency berechnen
    line_consistency = _line_consistency(left_words, right_words)

    # Entscheidung
    is_two_col = (
        largest_gap >= min_gap_abs and
        gap_rel >= min_gap_rel and
        line_consistency >= line_consistency_min
    )

    decision_reason = "two-column-gap" if is_two_col else "single-heuristic"

    # Wenn Force aktiv und harte Mindestbedingungen nicht völlig misslingen
    if force_two_column and not is_two_col:
        # Sehr kleiner Gap? Dann lieber nicht erzwingen
        if largest_gap >= (0.5 * min_gap_abs):
            decision_reason = "two-column-forced"
            is_two_col = True

    if not is_two_col:
        # Single column → einfache Text-Extraktion
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method=decision_reason,
            columns=1,
            meta={
                "words": len(words),
                "gap_abs": largest_gap,
                "gap_rel": round(gap_rel, 4),
                "line_consistency": round(line_consistency, 4),
                "split_x": round(candidate_split, 2),
                "left_count": len(left_words),
                "right_count": len(right_words),
                "forced": force_two_column
            }
        )

    # Zwei-Spalten-Aufbereitung
    left_lines = _lines_from_words(left_words)
    right_lines = _lines_from_words(right_words)
    merged = left_lines + right_lines  # Reihenfolge: komplette linke Spalte, dann rechte

    return PageLayoutResult(
        lines=[l for l in merged if l.strip()],
        method=decision_reason,
        columns=2,
        meta={
            "words": len(words),
            "gap_abs": largest_gap,
            "gap_rel": round(gap_rel, 4),
            "line_consistency": round(line_consistency, 4),
            "split_x": round(candidate_split, 2),
            "left_count": len(left_words),
            "right_count": len(right_words),
            "forced": force_two_column
        }
    )

def _line_consistency(left_words, right_words):
    """
    Heuristik: Wir gruppieren Wörter (beide Spalten) nach y und schauen:
    Anteil Zeilen, deren Wörter überwiegend (>=70%) nur in EINER Spalte vorkommen.
    """
    # Markiere Words
    tagged = []
    for w in left_words:
        tagged.append(("L", w))
    for w in right_words:
        tagged.append(("R", w))
    if not tagged:
        return 0.0

    buckets = {}
    for side, w in tagged:
        # Grobe Quantisierung der y-Position
        ykey = round(w["top"] / 3)
        buckets.setdefault(ykey, []).append(side)

    stable = 0
    total = 0
    for _, sides in buckets.items():
        total += 1
        count_L = sides.count("L")
        count_R = len(sides) - count_L
        dominant = max(count_L, count_R) / len(sides)
        if dominant >= 0.7:
            stable += 1

    if total == 0:
        return 0.0
    return stable / total

def _lines_from_words(words):
    """
    Einfache Zeilengruppierung nach y, dann Sortierung nach x0.
    """
    if not words:
        return []
    lines_map = {}
    for w in words:
        ykey = round(w["top"] / 3)
        lines_map.setdefault(ykey, []).append(w)
    lines = []
    for y in sorted(lines_map.keys()):
        seg = sorted(lines_map[y], key=lambda x: x["x0"])
        lines.append(" ".join(word["text"] for word in seg))
    return lines

def _clean_lines(lines):
    out = []
    for l in lines:
        l = l.rstrip()
        if l.strip():
            out.append(l)
    return out

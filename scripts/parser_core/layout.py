import statistics
from typing import List, Tuple, Dict, Optional
import pdfplumber

# Toleranzen
Y_LINE_TOL = 3.2     # maximale y-Differenz, damit Wörter als gleiche Zeile gelten
MIN_WORDS_FOR_COLUMN_SPLIT = 25
MIN_COLUMN_GAP = 25.0  # Mindestabstand zwischen den beiden Spaltencentern

class PageLayoutResult:
    def __init__(self, lines: List[str], method: str, columns: int):
        self.lines = lines
        self.method = method      # 'single', 'two-column', 'fallback'
        self.columns = columns

def detect_columns(words: List[Dict]) -> Tuple[int, Optional[float]]:
    """
    Ermittelt ob 1 oder 2 Spalten vorliegen.
    Rückgabe: (1|2, gap_center) – gap_center ist x-Grenze zwischen Spalten bei 2 Spalten.
    Heuristik:
      - Sortiere nach x0
      - Berechne x-Mittelpunkte (x_mid = (x0 + x1)/2)
      - Suche größte Lücke zwischen aufsteigend sortierten Mittelpunkten, wenn sie signifikant
    """
    if len(words) < MIN_WORDS_FOR_COLUMN_SPLIT:
        return 1, None
    mids = sorted(((w["x0"] + w["x1"]) / 2.0) for w in words)
    # Berechne Differenzen
    diffs = []
    for i in range(1, len(mids)):
        diffs.append((mids[i] - mids[i-1], (mids[i] + mids[i-1]) / 2.0))
    # Finde größte Lücke
    if not diffs:
        return 1, None
    diffs.sort(key=lambda x: x[0], reverse=True)
    largest_gap, gap_center = diffs[0]
    # Referenz: mittlere Diff + Std-Abweichung
    gap_values = [d for d, _ in diffs[1:]] or [largest_gap]
    ref_mean = statistics.mean(gap_values)
    ref_std = statistics.pstdev(gap_values) if len(gap_values) > 1 else 0
    # Kriterium: größte Lücke deutlich größer als (mean + std) und über MIN_COLUMN_GAP
    if largest_gap >= max(MIN_COLUMN_GAP, ref_mean + ref_std * 1.2):
        return 2, gap_center
    return 1, None

def assign_column(word: Dict, gap_center: float) -> int:
    mid = (word["x0"] + word["x1"]) / 2.0
    return 0 if mid < gap_center else 1

def group_words_into_lines(words: List[Dict]) -> List[str]:
    """
    Nimmt bereits sortierte Wörter einer Spalte (nach y, dann x) und gruppiert sie zu Zeilen.
    """
    lines = []
    current_line_y = None
    current_tokens = []
    for w in words:
        y_top = w["top"]
        if current_line_y is None:
            current_line_y = y_top
            current_tokens = [w["text"]]
            continue
        if abs(y_top - current_line_y) <= Y_LINE_TOL:
            current_tokens.append(w["text"])
        else:
            lines.append(" ".join(current_tokens))
            current_line_y = y_top
            current_tokens = [w["text"]]
    if current_tokens:
        lines.append(" ".join(current_tokens))
    return lines

def extract_page_layout(page) -> PageLayoutResult:
    """
    Layout-bewusste Extraktion für eine Seite.
    """
    try:
        words = page.extract_words(
            use_text_flow=True,
            keep_blank_chars=False,
            extra_attrs=["fontname", "size"]
        )
    except Exception:
        # Fallback
        txt = page.extract_text() or ""
        return PageLayoutResult(
            [l.rstrip() for l in txt.splitlines() if l.strip()],
            method="fallback",
            columns=1
        )

    if not words:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            [l.rstrip() for l in txt.splitlines() if l.strip()],
            method="empty-fallback",
            columns=1
        )

    # Sortiere global
    words_sorted = sorted(words, key=lambda w: (w["top"], w["x0"]))
    col_count, gap_center = detect_columns(words_sorted)

    if col_count == 1:
        # Eine Spalte → normal nach y, dann x gruppieren
        lines = group_words_into_lines(words_sorted)
        return PageLayoutResult(lines, method="single", columns=1)

    # Zwei Spalten
    left_words = []
    right_words = []
    for w in words_sorted:
        (left_words if assign_column(w, gap_center) == 0 else right_words).append(w)

    # Sortiere jede Spalte erneut (top, x0)
    left_words.sort(key=lambda w: (w["top"], w["x0"]))
    right_words.sort(key=lambda w: (w["top"], w["x0"]))

    left_lines = group_words_into_lines(left_words)
    right_lines = group_words_into_lines(right_words)

    # Endgültige Reihenfolge: erst links alle, dann rechts alle
    lines = left_lines + right_lines
    return PageLayoutResult(lines, method="two-column", columns=2)

def extract_pages_with_layout(pdf_path: str) -> Tuple[List[List[str]], List[Dict]]:
    """
    Liefert:
      - pages_lines: List[List[str]] pro Seite
      - debug_info: pro Seite dictionary {page, method, columns}
    """
    pages_lines = []
    debug_meta = []
    with pdfplumber.open(pdf_path) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            result = extract_page_layout(page)
            pages_lines.append(result.lines)
            debug_meta.append({
                "page": idx,
                "method": result.method,
                "columns": result.columns
            })
    return pages_lines, debug_meta

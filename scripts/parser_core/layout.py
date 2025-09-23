import pdfplumber
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
import math
from collections import Counter

@dataclass
class PageLayoutResult:
    lines: List[str]
    method: str
    columns: int
    meta: Dict[str, Any]

def extract_pages_with_layout(pdf_path: str,
                              force_two_column: bool = True,
                              min_words_for_detection: int = 25,
                              min_side_fraction: float = 0.10,
                              hist_bins: int = 80,
                              min_peak_separation_rel: float = 0.22,
                              min_valley_rel_drop: float = 0.35,
                              line_y_quant: float = 3.0):
    """
    Zwei-Spalten-Erkennung ohne externe Dependencies.

    force_two_column:    Wenn True -> wenn kein sauberer Split ermittelt werden kann,
                         wird ein 'best guess' gewählt (two-column-forced), solange
                         beide Seiten ausreichend Wörter enthalten.
    min_words_for_detection: Mindestanzahl Wörter pro Seite, bevor wir überhaupt einen Split versuchen.
    min_side_fraction:  Mindestens dieser Anteil (0..1) aller Wörter muss pro Seite landen,
                         sonst gilt Split als ungültig (außer forced).
    hist_bins:          Anzahl Histogramm-Bins für Midpoint-Verteilung.
    min_peak_separation_rel: Relativer Mindestabstand (in % Seitenbreite) zwischen zwei Peaks.
    min_valley_rel_drop: Relativer Einbruch (Valley) zwischen Peaks gegenüber dem Durchschnitt der Peak-Höhen.
    line_y_quant:       y-Quantisierung für Zeilenbucketing (kleiner = feinere Zeilen).
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
                min_side_fraction=min_side_fraction,
                hist_bins=hist_bins,
                min_peak_sep_rel=min_peak_separation_rel,
                min_valley_rel_drop=min_valley_rel_drop,
                line_y_quant=line_y_quant
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
                  min_side_fraction: float,
                  hist_bins: int,
                  min_peak_sep_rel: float,
                  min_valley_rel_drop: float,
                  line_y_quant: float) -> PageLayoutResult:

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
            lines=[], method="empty-page", columns=1, meta={}
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

    if len(words) < min_words_for_detection and not force_two_column:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="single-low-word-count",
            columns=1,
            meta={"words": len(words)}
        )

    # Wortmittelpunkte
    mid_word_pairs = [(((w["x0"] + w["x1"]) / 2.0), w) for w in words]
    mid_word_pairs.sort(key=lambda x: x[0])
    mids = [mw[0] for mw in mid_word_pairs]

    # 1) Histogrammverfahren
    hist_decision = _histogram_split(
        mids, page_width, hist_bins,
        min_peak_sep_rel=min_peak_sep_rel,
        min_valley_rel_drop=min_valley_rel_drop
    )

    debug_info: Dict[str, Any] = {
        "words": len(words),
        "page_width": round(page_width, 2),
    }

    split_candidates: List[Tuple[float, str, Dict[str, Any]]] = []
    if hist_decision:
        split_x, meta = hist_decision
        split_candidates.append((split_x, "two-column-hist", meta))

    # 2) Zeilenbasierte Analyse (line voting)
    line_split = _line_based_split(mid_word_pairs, page_width, line_y_quant=line_y_quant)
    if line_split:
        split_x, meta = line_split
        split_candidates.append((split_x, "two-column-lines", meta))

    # 3) Wähle besten Kandidaten nach (1) minimaler Balance-Diskrepanz (Differenz der Wortzahlen)
    chosen = None
    if split_candidates:
        evals = []
        for split_x, method_name, meta in split_candidates:
            left_words = [w for mid, w in mid_word_pairs if mid < split_x]
            right_words = [w for mid, w in mid_word_pairs if mid >= split_x]
            imbalance = abs(len(left_words) - len(right_words))
            evals.append((imbalance, split_x, method_name, meta, left_words, right_words))
        evals.sort(key=lambda x: x[0])  # minimaler Imbalance zuerst
        imbalance, split_x, method_name, method_meta, left_words, right_words = evals[0]
        frac_left = len(left_words)/len(words)
        frac_right = len(right_words)/len(words)
        if frac_left >= min_side_fraction and frac_right >= min_side_fraction:
            chosen = (split_x, method_name, method_meta, left_words, right_words)
            debug_info["candidate_methods"] = [c[2] for c in evals[:3]]
        else:
            debug_info["candidate_rejected_min_side_fraction"] = {
                "frac_left": round(frac_left,3),
                "frac_right": round(frac_right,3),
                "min_side_fraction": min_side_fraction
            }

    # 4) Falls kein Kandidat brauchbar und Force aktiv -> erzwingen
    if chosen is None and force_two_column:
        # Einfacher heuristischer Split: median midpoint
        median_mid = mids[len(mids)//2]
        # Variation: probiere Offsets (40%..60%)
        fallback_splits = [
            page_width * 0.45,
            page_width * 0.50,
            page_width * 0.40,
            median_mid,
            page_width * 0.55
        ]
        best_fb = None
        for split_x in fallback_splits:
            left_words = [w for mid, w in mid_word_pairs if mid < split_x]
            right_words = [w for mid, w in mid_word_pairs if mid >= split_x]
            frac_left = len(left_words)/len(words)
            frac_right = len(right_words)/len(words)
            if frac_left >= min_side_fraction and frac_right >= min_side_fraction:
                imbalance = abs(len(left_words) - len(right_words))
                if best_fb is None or imbalance < best_fb[0]:
                    best_fb = (imbalance, split_x, left_words, right_words, frac_left, frac_right)
        if best_fb:
            _, split_x, left_words, right_words, frac_left, frac_right = best_fb
            chosen = (
                split_x,
                "two-column-forced",
                {
                    "forced_reason": "no_valid_hist_or_line_candidate",
                    "frac_left": round(frac_left,3),
                    "frac_right": round(frac_right,3)
                },
                left_words,
                right_words
            )

    # 5) Falls immer noch nichts → Single
    if chosen is None:
        txt = page.extract_text() or ""
        single_meta = {
            **debug_info,
            "reason": "no_split_candidate",
            "force_two_column": force_two_column
        }
        if hist_decision:
            single_meta["hist_meta"] = hist_decision[1]
        if line_split:
            single_meta["line_meta"] = line_split[1]
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="single-fallback",
            columns=1,
            meta=single_meta
        )

    split_x, method_name, method_meta, left_words, right_words = chosen
    left_lines = _lines_from_words(left_words, line_y_quant)
    right_lines = _lines_from_words(right_words, line_y_quant)
    merged = left_lines + right_lines

    meta = {
        **debug_info,
        **method_meta,
        "split_x": round(split_x,2),
        "left_count": len(left_words),
        "right_count": len(right_words),
        "left_fraction": round(len(left_words)/len(words),3),
        "right_fraction": round(len(right_words)/len(words),3),
        "force_two_column": force_two_column
    }

    return PageLayoutResult(
        lines=[l for l in merged if l.strip()],
        method=method_name,
        columns=2,
        meta=meta
    )

def _histogram_split(mids: List[float],
                     page_width: float,
                     bins: int,
                     min_peak_sep_rel: float,
                     min_valley_rel_drop: float):
    if len(mids) < 10 or page_width <= 0:
        return None
    lo = min(mids); hi = max(mids)
    if hi - lo < page_width * 0.3:
        # Sehr kompakt – wohl keine zwei klar getrennten Spalten
        return None
    bin_w = (hi - lo) / bins if bins > 0 else (hi - lo)
    if bin_w <= 0:
        return None

    counts = []
    edges = []
    for i in range(bins):
        start = lo + i*bin_w
        end = start + bin_w
        edges.append((start, end))
        cnt = sum(1 for m in mids if start <= m < end)  # naive; ok für moderate Wortzahlen
        counts.append(cnt)

    # Finde Peaks (lokale Maxima)
    peaks = []
    for i in range(1, bins-1):
        if counts[i] > counts[i-1] and counts[i] > counts[i+1]:
            peaks.append((counts[i], i))
    if len(peaks) < 2:
        return None
    # Top 2 Peaks
    peaks.sort(reverse=True)
    top2 = peaks[:2]
    p1, p2 = sorted(top2, key=lambda x: x[1])  # nach Index
    c1, i1 = p1
    c2, i2 = p2
    # Indizes weit genug auseinander?
    dist_bins = abs(i2 - i1)
    center1 = (edges[i1][0] + edges[i1][1]) / 2.0
    center2 = (edges[i2][0] + edges[i2][1]) / 2.0
    sep_abs = abs(center2 - center1)
    sep_rel = sep_abs / page_width
    if sep_rel < min_peak_sep_rel:
        return None

    # Valley suchen zwischen i1 und i2 (exklusiv)
    valley = None
    valley_i = None
    for j in range(min(i1,i2)+1, max(i1,i2)):
        if valley is None or counts[j] < valley:
            valley = counts[j]; valley_i = j
    if valley is None:
        return None

    avg_peak_height = (c1 + c2) / 2.0
    if avg_peak_height == 0:
        return None
    drop_rel = 1.0 - (valley / avg_peak_height)

    if drop_rel < min_valley_rel_drop:
        # Tal nicht tief genug
        return None

    valley_center = (edges[valley_i][0] + edges[valley_i][1]) / 2.0
    meta = {
        "hist_peak1_bin": i1,
        "hist_peak2_bin": i2,
        "hist_peak1_center": round(center1,2),
        "hist_peak2_center": round(center2,2),
        "hist_sep_abs": round(sep_abs,2),
        "hist_sep_rel": round(sep_rel,3),
        "hist_valley_bin": valley_i,
        "hist_valley_drop_rel": round(drop_rel,3),
        "hist_bins": bins
    }
    return valley_center, meta

def _line_based_split(mid_word_pairs, page_width: float, line_y_quant: float):
    """
    Zeilenweise: Für jede Zeile (y quantisiert) X-Min + X-Max sammeln.
    Falls genug Zeilen zwei „Clusterlöcher“ nahe einer vertikalen Trennzone zeigen,
    Vote-Mechanismus: Candidate Split = Durchschnitt der linearen Lücken-Zentren.
    """
    buckets = {}
    for mid, w in mid_word_pairs:
        ykey = round(w["top"] / line_y_quant)
        buckets.setdefault(ykey, []).append((mid, w))

    gap_centers = []
    total_lines = 0
    considered_lines = 0
    for yk, entries in buckets.items():
        total_lines += 1
        entries.sort(key=lambda x: x[0])
        mids_line = [e[0] for e in entries]
        # Finde größte Lücke in dieser Zeile
        if len(mids_line) < 2:
            continue
        gaps = []
        for i in range(1, len(mids_line)):
            gap = mids_line[i] - mids_line[i-1]
            gaps.append((gap, (mids_line[i] + mids_line[i-1]) / 2.0))
        gaps.sort(reverse=True)
        largest_gap, gap_center = gaps[0]
        # Heuristik: wenn Lücke > 0.15 * page_width → potentielle Spaltentrennung in der Zeile
        if largest_gap > page_width * 0.15:
            considered_lines += 1
            gap_centers.append(gap_center)

    if not gap_centers:
        return None

    # Cluster der gap_centers grob: median
    # (Wir brauchen eigentlich nur EIN robustes Zentrum)
    # Wenn Streuung groß, uninteressant.
    mean_gap = sum(gap_centers) / len(gap_centers)
    # optional: Varianz prüfen
    variance = sum((g - mean_gap)**2 for g in gap_centers) / len(gap_centers)
    stddev = math.sqrt(variance)
    if stddev > page_width * 0.08 and considered_lines < max(5, 0.2 * total_lines):
        return None

    meta = {
        "line_total_buckets": total_lines,
        "line_candidate_votes": considered_lines,
        "line_gap_center_mean": round(mean_gap,2),
        "line_gap_center_stddev": round(stddev,2)
    }
    return mean_gap, meta

def _lines_from_words(words, line_y_quant: float):
    if not words:
        return []
    lines_map = {}
    for w in words:
        ykey = round(w["top"] / line_y_quant)
        lines_map.setdefault(ykey, []).append(w)
    lines = []
    for y in sorted(lines_map.keys()):
        seg = sorted(lines_map[y], key=lambda x: x["x0"])
        lines.append(" ".join(s["text"] for s in seg))
    return lines

def _clean_lines(lines):
    out = []
    for l in lines:
        l = l.rstrip()
        if l.strip():
            out.append(l)
    return out

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
                              min_words_for_detection: int = 25,
                              min_side_fraction: float = 0.10,
                              hist_bins: int = 80,
                              min_peak_separation_rel: float = 0.18,
                              min_valley_rel_drop: float = 0.30,
                              line_y_quant: float = 3.0,
                              rebalance_target_low: float = 0.42,
                              rebalance_target_high: float = 0.58,
                              rebalance_scan_step: float = 5.0,
                              # Alias für Abwärtskompatibilität
                              min_peak_sep_rel: float | None = None):
    """
    Zwei-Spalten-Erkennung (Histogramm + Zeilen-Heuristik) plus Rebalancing.

    Parameter:
      force_two_column: Erzwinge immer einen Split (mit Heuristik), wenn möglich.
      min_words_for_detection: Mindestanzahl Wörter, bevor überhaupt versucht wird zu splitten.
      min_side_fraction: Mindestanteil an Wörtern je Seite für einen gültigen Split.
      hist_bins: Anzahl Bins für Histogramm der Wortmittelpunkte.
      min_peak_separation_rel: relative Mindestdistanz (in % der Seitenbreite) zwischen zwei Peaks.
      min_valley_rel_drop: erforderliche relative Absenkung im Tal zwischen den Peaks.
      line_y_quant: Quantisierung der y-Koordinate zur Zeilenbildung.
      rebalance_target_low/high: Zielbereich für linke Spaltenfraktion nach Rebalancing.
      rebalance_scan_step: Schrittweite beim Rebalancing-Scan.
      min_peak_sep_rel: Alias (falls alte Aufrufe noch diesen Namen nutzen).
    """
    # Alias-Handling
    if min_peak_sep_rel is not None and min_peak_separation_rel == 0.18:
        min_peak_separation_rel = min_peak_sep_rel

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
                line_y_quant=line_y_quant,
                rebalance_target_low=rebalance_target_low,
                rebalance_target_high=rebalance_target_high,
                rebalance_scan_step=rebalance_scan_step
            )
            # Param-Info ergänzen
            result.meta.setdefault("param_min_peak_separation_rel", round(min_peak_separation_rel, 4))
            if min_peak_sep_rel is not None:
                result.meta.setdefault("param_alias_used", True)

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
                  line_y_quant: float,
                  rebalance_target_low: float,
                  rebalance_target_high: float,
                  rebalance_scan_step: float) -> PageLayoutResult:

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
        return PageLayoutResult(lines=[], method="empty-page", columns=1, meta={})

    pw = float(page.width or 0.0)
    if pw <= 0:
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

    mid_word_pairs = [(((w["x0"] + w["x1"]) / 2.0), w) for w in words]
    mid_word_pairs.sort(key=lambda x: x[0])
    mids = [m for m, _ in mid_word_pairs]

    debug_info: Dict[str, Any] = {
        "words": len(words),
        "page_width": round(pw, 2)
    }

    hist_decision = _histogram_split(
        mids, pw, hist_bins,
        min_peak_sep_rel=min_peak_sep_rel,
        min_valley_rel_drop=min_valley_rel_drop
    )
    split_candidates: List[Tuple[float, str, Dict[str, Any]]] = []
    if hist_decision:
        split_x, meta = hist_decision
        split_candidates.append((split_x, "two-column-hist", meta))

    line_decision = _line_based_split(mid_word_pairs, pw, line_y_quant=line_y_quant)
    if line_decision:
        split_x, meta = line_decision
        split_candidates.append((split_x, "two-column-lines", meta))

    chosen = None
    if split_candidates:
        evals = []
        for split_x, method_name, meta in split_candidates:
            left_words = [w for m, w in mid_word_pairs if m < split_x]
            right_words = [w for m, w in mid_word_pairs if m >= split_x]
            imbalance = abs(len(left_words) - len(right_words))
            evals.append((imbalance, split_x, method_name, meta, left_words, right_words))
        evals.sort(key=lambda x: x[0])
        imbalance, sx, mname, mmeta, lws, rws = evals[0]
        frac_left = len(lws) / len(words)
        frac_right = len(rws) / len(words)
        if frac_left >= min_side_fraction and frac_right >= min_side_fraction:
            chosen = (sx, mname, mmeta, lws, rws)
            debug_info["candidate_methods"] = [e[2] for e in evals[:3]]
        else:
            debug_info["candidate_rejected_min_side_fraction"] = {
                "frac_left": round(frac_left, 3),
                "frac_right": round(frac_right, 3),
                "min_side_fraction": min_side_fraction
            }

    if chosen is None and force_two_column:
        forced = _forced_balance_scan(mid_word_pairs, words, pw, min_side_fraction)
        if forced:
            chosen = (*forced, )

    if chosen is None:
        txt = page.extract_text() or ""
        single_meta = {
            **debug_info,
            "reason": "no_split_candidate",
            "force_two_column": force_two_column
        }
        if hist_decision:
            single_meta["hist_meta"] = hist_decision[1]
        if line_decision:
            single_meta["line_meta"] = line_decision[1]
        return PageLayoutResult(
            lines=_clean_lines(txt.splitlines()),
            method="single-fallback",
            columns=1,
            meta=single_meta
        )

    split_x, method_name, method_meta, left_words, right_words = chosen
    frac_left = len(left_words) / len(words)
    frac_right = len(right_words) / len(words)

    # Rebalance falls ungleich
    rebalanced = False
    if not (rebalance_target_low <= frac_left <= rebalance_target_high):
        reb = _rebalance_split(mid_word_pairs, pw, left_words, right_words,
                               initial_split_x=split_x,
                               target_low=rebalance_target_low,
                               target_high=rebalance_target_high,
                               scan_step=rebalance_scan_step)
        if reb:
            rebalanced = True
            split_x, left_words, right_words, frac_left, frac_right, extra_meta = reb
            method_name = method_name + "-rebalanced"
            method_meta["rebalance"] = extra_meta

    left_lines = _lines_from_words(left_words, line_y_quant)
    right_lines = _lines_from_words(right_words, line_y_quant)
    merged = left_lines + right_lines

    meta = {
        **debug_info,
        **method_meta,
        "split_x": round(split_x, 2),
        "left_count": len(left_words),
        "right_count": len(right_words),
        "left_fraction": round(frac_left, 3),
        "right_fraction": round(frac_right, 3),
        "force_two_column": force_two_column,
        "rebalanced": rebalanced
    }

    return PageLayoutResult(
        lines=[l for l in merged if l.strip()],
        method=method_name,
        columns=2,
        meta=meta
    )

def _forced_balance_scan(mid_word_pairs, words_all, page_width, min_side_fraction):
    total = len(words_all)
    lo = page_width * 0.35
    hi = page_width * 0.65
    steps = max(1, int((hi - lo) / 10))
    best = None
    for i in range(steps + 1):
        x = lo + i * (hi - lo) / steps
        left_words = [w for m, w in mid_word_pairs if m < x]
        right_words = [w for m, w in mid_word_pairs if m >= x]
        fl = len(left_words) / total
        fr = len(right_words) / total
        if fl >= min_side_fraction and fr >= min_side_fraction:
            imbalance = abs(fl - 0.5)
            penalty = _mixed_line_penalty(left_words, right_words)
            score = imbalance * 2 + penalty * 0.5
            if best is None or score < best[0]:
                best = (score, x, left_words, right_words, fl, fr, penalty)
    if best:
        _, sx, lws, rws, fl, fr, penalty = best
        return (sx, "two-column-forced", {
            "forced_reason": "forced_balance_scan",
            "forced_penalty": round(penalty, 3)
        }, lws, rws)
    return None

def _rebalance_split(mid_word_pairs,
                     page_width,
                     left_words_initial,
                     right_words_initial,
                     initial_split_x,
                     target_low,
                     target_high,
                     scan_step: float):
    total = len(left_words_initial) + len(right_words_initial)
    scan_lo = page_width * 0.35
    scan_hi = page_width * 0.65
    candidate_positions = set()

    mids_only = [m for m, _ in mid_word_pairs]
    for i in range(1, len(mids_only)):
        gap_mid = (mids_only[i] + mids_only[i-1]) / 2.0
        if scan_lo <= gap_mid <= scan_hi:
            candidate_positions.add(round(gap_mid, 2))

    x = scan_lo
    while x <= scan_hi:
        candidate_positions.add(round(x, 2))
        x += scan_step

    candidate_positions.add(round(initial_split_x, 2))

    best = None
    for sx in sorted(candidate_positions):
        lws = [w for m, w in mid_word_pairs if m < sx]
        rws = [w for m, w in mid_word_pairs if m >= sx]
        fl = len(lws) / total
        mp = _mixed_line_penalty(lws, rws)
        imbalance = abs(fl - 0.5)
        score = imbalance * 2 + mp * 0.6
        if best is None or score < best[0]:
            best = (score, sx, lws, rws, fl, 1 - fl, mp)
        if target_low <= fl <= target_high and mp == 0:
            break

    if not best:
        return None

    score, sx, lws, rws, fl, fr, mp = best
    initial_fl = len(left_words_initial) / total
    initial_imb = abs(initial_fl - 0.5)
    improved = abs(fl - 0.5) < initial_imb or (target_low <= fl <= target_high)

    if not improved:
        return None

    extra_meta = {
        "rebalance_initial_split_x": round(initial_split_x, 2),
        "rebalance_new_split_x": round(sx, 2),
        "rebalance_initial_left_fraction": round(initial_fl, 3),
        "rebalance_new_left_fraction": round(fl, 3),
        "rebalance_mixed_penalty": round(mp, 3),
        "rebalance_score": round(score, 3),
        "rebalance_initial_mixed_penalty": round(_mixed_line_penalty(left_words_initial, right_words_initial), 3)
    }
    return sx, lws, rws, fl, fr, extra_meta

def _mixed_line_penalty(left_words, right_words, y_quant=3.0):
    tagged = [("L", w) for w in left_words] + [("R", w) for w in right_words]
    if not tagged:
        return 0.0
    buckets = {}
    for side, w in tagged:
        yk = round(w["top"] / y_quant)
        buckets.setdefault(yk, []).append(side)
    mixed = sum(1 for sides in buckets.values() if "L" in sides and "R" in sides)
    total = len(buckets)
    return mixed / total if total else 0.0

def _histogram_split(mids: List[float],
                     page_width: float,
                     bins: int,
                     min_peak_sep_rel: float,
                     min_valley_rel_drop: float):
    if len(mids) < 10 or page_width <= 0:
        return None
    lo = min(mids); hi = max(mids)
    if hi - lo < page_width * 0.3:
        return None
    bin_w = (hi - lo) / bins if bins > 0 else (hi - lo)
    if bin_w <= 0:
        return None

    counts = []
    edges = []
    for i in range(bins):
        start = lo + i * bin_w
        end = start + bin_w
        edges.append((start, end))
        cnt = 0
        for m in mids:
            if start <= m < end:
                cnt += 1
        counts.append(cnt)

    peaks = []
    for i in range(1, bins - 1):
        if counts[i] > counts[i-1] and counts[i] > counts[i+1]:
            peaks.append((counts[i], i))
    if len(peaks) < 2:
        return None
    peaks.sort(reverse=True)
    top2 = peaks[:2]
    p1, p2 = sorted(top2, key=lambda x: x[1])
    c1, i1 = p1
    c2, i2 = p2
    center1 = (edges[i1][0] + edges[i1][1]) / 2.0
    center2 = (edges[i2][0] + edges[i2][1]) / 2.0
    sep_abs = abs(center2 - center1)
    sep_rel = sep_abs / page_width
    if sep_rel < min_peak_sep_rel:
        return None

    valley = None
    valley_i = None
    for j in range(i1 + 1, i2):
        val = counts[j]
        if valley is None or val < valley:
            valley = val
            valley_i = j
    if valley is None:
        return None
    avg_peak_height = (c1 + c2) / 2.0
    if avg_peak_height == 0:
        return None
    drop_rel = 1.0 - (valley / avg_peak_height)
    if drop_rel < min_valley_rel_drop:
        return None

    valley_center = (edges[valley_i][0] + edges[valley_i][1]) / 2.0
    meta = {
        "hist_peak1_center": round(center1, 2),
        "hist_peak2_center": round(center2, 2),
        "hist_sep_abs": round(sep_abs, 2),
        "hist_sep_rel": round(sep_rel, 3),
        "hist_valley_drop_rel": round(drop_rel, 3),
        "hist_valley_bin": valley_i,
        "hist_bins": bins
    }
    return valley_center, meta

def _line_based_split(mid_word_pairs, page_width: float, line_y_quant: float):
    buckets = {}
    for mid, w in mid_word_pairs:
        ykey = round(w["top"] / line_y_quant)
        buckets.setdefault(ykey, []).append((mid, w))

    gap_centers = []
    total_lines = 0
    considered = 0
    for yk, entries in buckets.items():
        total_lines += 1
        entries.sort(key=lambda x: x[0])
        mids_line = [e[0] for e in entries]
        if len(mids_line) < 2:
            continue
        gaps = []
        for i in range(1, len(mids_line)):
            gap = mids_line[i] - mids_line[i-1]
            gaps.append((gap, (mids_line[i] + mids_line[i-1]) / 2.0))
        gaps.sort(reverse=True)
        largest_gap, gap_center = gaps[0]
        if largest_gap > page_width * 0.15:
            considered += 1
            gap_centers.append(gap_center)

    if not gap_centers:
        return None

    mean_gap = sum(gap_centers) / len(gap_centers)
    variance = sum((g - mean_gap) ** 2 for g in gap_centers) / len(gap_centers)
    stddev = math.sqrt(variance)

    if stddev > page_width * 0.09 and considered < max(4, 0.08 * total_lines):
        return None

    meta = {
        "line_total_buckets": total_lines,
        "line_candidate_votes": considered,
        "line_gap_center_mean": round(mean_gap, 2),
        "line_gap_center_stddev": round(stddev, 2)
    }
    return mean_gap, meta

def _lines_from_words(words, line_y_quant: float):
    if not words:
        return []
    lines_map = {}
    for w in words:
        yk = round(w["top"] / line_y_quant)
        lines_map.setdefault(yk, []).append(w)
    out = []
    for y in sorted(lines_map.keys()):
        seg = sorted(lines_map[y], key=lambda x: x["x0"])
        out.append(" ".join(s["text"] for s in seg))
    return out

def _clean_lines(lines):
    res = []
    for l in lines:
        l = l.rstrip()
        if l.strip():
            res.append(l)
    return res

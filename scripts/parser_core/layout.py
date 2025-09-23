import pdfplumber
from dataclasses import dataclass
from typing import List, Dict, Any
import math

try:
    # Falls sklearn nicht installiert ist, fallback (du kannst stattdessen ein eigenes 2-Cluster-Verfahren schreiben)
    from sklearn.cluster import KMeans
    HAVE_SKLEARN = True
except Exception:
    HAVE_SKLEARN = False


@dataclass
class PageLayoutResult:
    lines: List[str]
    method: str
    columns: int
    meta: Dict[str, Any]


def extract_pages_with_layout(pdf_path: str,
                              force_two_column: bool = False,
                              min_words_for_detection: int = 40,
                              rel_gap_threshold: float = 0.25,
                              line_consistency_min: float = 0.55,
                              kmeans_init_runs: int = 5):
    """
    Extrahiert Seiten mit (potentieller) Zwei-Spalten-Logik.
    Gibt (pages_lines, debug_meta) zurück.
    """
    pages_lines = []
    debug_meta = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            res = _extract_page_layout(
                page,
                page_number=i,
                force_two_column=force_two_column,
                min_words_for_detection=min_words_for_detection,
                rel_gap_threshold=rel_gap_threshold,
                line_consistency_min=line_consistency_min,
                kmeans_init_runs=kmeans_init_runs
            )
            pages_lines.append(res.lines)
            debug_meta.append({
                "page": i,
                "method": res.method,
                "columns": res.columns,
                **res.meta
            })
    return pages_lines, debug_meta


def _extract_page_layout(page,
                         page_number: int,
                         force_two_column: bool,
                         min_words_for_detection: int,
                         rel_gap_threshold: float,
                         line_consistency_min: float,
                         kmeans_init_runs: int) -> PageLayoutResult:
    """
    Kernlogik für eine einzelne Seite.
    """
    try:
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    except Exception as e:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=[l for l in txt.splitlines() if l.strip()],
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

    # Falls zu wenig Wörter, keine aufwendige Spaltenerkennung
    if len(words) < min_words_for_detection and not force_two_column:
        txt = page.extract_text() or ""
        return PageLayoutResult(
            lines=[l for l in txt.splitlines() if l.strip()],
            method="single-low-word-count",
            columns=1,
            meta={"words": len(words)}
        )

    # Wortmittelpunkte
    mids = [ ( (w["x0"]+w["x1"])/2.0, w ) for w in words ]

    # Force: Wenn user unbedingt zwei Spalten will -> versuche Clustering trotzdem
    if force_two_column:
        two_col = True
    else:
        two_col = _decide_two_column_via_kmeans(
            mids,
            page_width=page_width,
            rel_gap_threshold=rel_gap_threshold,
            line_consistency_min=line_consistency_min,
            kmeans_init_runs=kmeans_init_runs
        )

    if two_col:
        cluster_data = _cluster_columns(
            mids,
            page_width=page_width,
            kmeans_init_runs=kmeans_init_runs
        )
        # Wenn Clustering wegen fehlender sklearn scheitert → fallback
        if cluster_data.get("failed"):
            txt = page.extract_text() or ""
            return PageLayoutResult(
                lines=[l for l in txt.splitlines() if l.strip()],
                method="single-no-sklearn",
                columns=1,
                meta={"words": len(words), "note": "sklearn not available"}
            )

        # Spaltenweise Zeilen bauen
        left_lines = _lines_from_words(cluster_data["left_words"])
        right_lines = _lines_from_words(cluster_data["right_words"])

        merged_lines = left_lines + right_lines  # einfache Linearisation

        return PageLayoutResult(
            lines=[l for l in merged_lines if l.strip()],
            method=cluster_data["decision_method"],
            columns=2,
            meta={
                "words": len(words),
                "center_gap_abs": cluster_data["center_gap_abs"],
                "center_gap_rel": cluster_data["center_gap_rel"],
                "line_consistency": cluster_data["line_consistency"],
                "left_word_count": len(cluster_data["left_words"]),
                "right_word_count": len(cluster_data["right_words"]),
                "forced": force_two_column
            }
        )

    # Single-Spalten-Fall
    txt = page.extract_text() or ""
    return PageLayoutResult(
        lines=[l for l in txt.splitlines() if l.strip()],
        method="single-heuristic",
        columns=1,
        meta={
            "words": len(words),
            "forced": force_two_column
        }
    )


def _decide_two_column_via_kmeans(mids_with_words,
                                  page_width: float,
                                  rel_gap_threshold: float,
                                  line_consistency_min: float,
                                  kmeans_init_runs: int) -> bool:
    if not HAVE_SKLEARN or page_width <= 0:
        return False

    xs = [mw[0] for mw in mids_with_words]
    if len(set(xs)) < 6:
        return False  # zu wenig horizontale Varianz

    import numpy as np
    data = np.array(xs).reshape(-1, 1)

    best_inertia = None
    best_model = None
    for _ in range(kmeans_init_runs):
        m = KMeans(n_clusters=2, n_init="auto", random_state=None)
        m.fit(data)
        if best_inertia is None or m.inertia_ < best_inertia:
            best_inertia = m.inertia_
            best_model = m

    centers = sorted(c[0] for c in best_model.cluster_centers_)
    center_gap_abs = centers[1] - centers[0]
    center_gap_rel = center_gap_abs / page_width if page_width > 0 else 0.0

    labels = best_model.labels_

    # Zeilen-Konsistenz
    line_consistency = _evaluate_line_consistency(mids_with_words, labels)

    return (center_gap_rel >= rel_gap_threshold) and (line_consistency >= line_consistency_min)


def _cluster_columns(mids_with_words,
                     page_width: float,
                     kmeans_init_runs: int):
    if not HAVE_SKLEARN or page_width <= 0:
        return {"failed": True}

    import numpy as np
    xs = [mw[0] for mw in mids_with_words]
    data = np.array(xs).reshape(-1, 1)
    best_inertia = None
    best_model = None
    for _ in range(kmeans_init_runs):
        m = KMeans(n_clusters=2, n_init="auto", random_state=None)
        m.fit(data)
        if best_inertia is None or m.inertia_ < best_inertia:
            best_inertia = m.inertia_
            best_model = m

    centers = sorted(c[0] for c in best_model.cluster_centers_)
    center_gap_abs = centers[1] - centers[0]
    center_gap_rel = center_gap_abs / page_width if page_width else 0.0
    labels = best_model.labels_
    line_consistency = _evaluate_line_consistency(mids_with_words, labels)

    # Re-Konstruktion linker / rechter Satz
    # weise Label <-> left/right zu anhand der Center-Reihenfolge
    # Erzeuge Mapping
    label_center_pairs = sorted(zip(best_model.cluster_centers_, [0,1]), key=lambda x: x[0])
    # label_of_left = index des cluster dessen center kleiner ist
    # Wir invertieren Label falls nötig
    left_label = None
    if label_center_pairs[0][0] == best_model.cluster_centers_[0][0]:
        # cluster 0 ist linke Spalte
        left_label = 0
    else:
        left_label = 1

    left_words = []
    right_words = []
    for (mid, w), lab in zip(mids_with_words, labels):
        if lab == left_label:
            left_words.append(w)
        else:
            right_words.append(w)

    return {
        "decision_method": "two-column-kmeans",
        "center_gap_abs": center_gap_abs,
        "center_gap_rel": center_gap_rel,
        "line_consistency": line_consistency,
        "left_words": left_words,
        "right_words": right_words
    }


def _evaluate_line_consistency(mids_with_words, labels):
    """
    Gruppiert Wörter in grobe Zeilen und prüft,
    wie oft eine Zeile überwiegend EIN Cluster enthält.
    """
    # Wir nehmen das originale word-Objekt und labels in gleicher Reihenfolge.
    # pdfplumber words enthalten "top".
    # Wir quantisieren y (top) etwas robust.
    buckets = {}
    for (mid, w), lab in zip(mids_with_words, labels):
        ykey = round(w["top"] / 3)  # gröberes Bucketing
        buckets.setdefault(ykey, []).append(lab)

    stable = 0
    total = 0
    for yk, labs in buckets.items():
        total += 1
        # wenn >70% derselben Klasse → stabil
        if labs.count(labs[0]) / len(labs) >= 0.7:
            stable += 1
    if total == 0:
        return 0.0
    return stable / total


def _lines_from_words(words):
    """
    Sehr einfache Zeilengruppierung nach y-Koordinate.
    Besser könnte man: Clustering + horizontales Sortieren.
    """
    if not words:
        return []
    lines_map = {}
    for w in words:
        ykey = round(w["top"] / 3)
        lines_map.setdefault(ykey, []).append(w)
    lines = []
    for y in sorted(lines_map.keys()):
        # Sortiere nach x0
        seg = sorted(lines_map[y], key=lambda x: x["x0"])
        lines.append(" ".join(t["text"] for t in seg))
    return lines

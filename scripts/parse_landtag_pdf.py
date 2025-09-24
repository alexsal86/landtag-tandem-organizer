#!/usr/bin/env python3
"""
parse_landtag_pdf.py

Pipeline zum Herunterladen und Parsen eines Landtagsprotokolls.
(gekürzte Header-Dokumentation im Kommentar)
"""
import argparse
import json
import os
import sys
import datetime
import hashlib
import re
from pathlib import Path
from typing import List, Dict, Any

from parser_core.downloader import download_pdf
from parser_core.pdftext import remove_repeated_headers_footers, flatten_pages
from parser_core.layout import extract_pages_with_layout
from parser_core.normalize import normalize_line, dehyphenate
from parser_core.segment import segment_speeches
from parser_core.agenda import extract_agenda, link_agenda
from parser_core.metadata import parse_session_info
from parser_core.schema_def import validate_payload
from parser_core.toc import parse_toc, partition_toc
from parser_core.cleanup import clean_page_footers, cleanup_interjections
from parser_core.textflow import reflow_speeches
from parser_core.segments import build_speech_segments

# Neuer TOC-Parser (strukturierte TOC "items")
try:
    from scripts.parser_core.pipeline import parse_protocol as parse_protocol_new
except Exception:
    parse_protocol_new = None


def parse_args():
    ap = argparse.ArgumentParser(description="Parst ein Landtags-PDF und erzeugt strukturierte JSON-Ausgabe.")
    ap.add_argument("--list-file", help="Datei mit Zeilenweise URLs (optional).")
    ap.add_argument("--single-url", help="Einzelne PDF-URL.")
    ap.add_argument("--schema-validate", action="store_true", help="Schema-Validierung aktivieren.")
    ap.add_argument("--force-download", action="store_true", help="PDF erneut herunterladen, auch wenn im Cache.")
    ap.add_argument("--layout-min-peak-sep", type=float, default=0.18, help="min_peak_separation_rel für Layout.")
    ap.add_argument("--layout-min-valley-drop", type=float, default=0.30, help="min_valley_rel_drop für Layout.")
    ap.add_argument("--no-new-toc", action="store_true", help="Neuen TOC-Parser deaktivieren (Fallback auf alten Parser).")
    ap.add_argument("--body-start-pattern", default=r'^(Präsident(?:in)?|Vorsitz(?:ender|ende)|Präsident\.)\b.*:', help="Regex für Body-Start (erste Rede).")
    return ap.parse_args()


def gather_urls(args) -> List[str]:
    if args.single_url:
        return [args.single_url.strip()]
    if args.list_file and os.path.isfile(args.list_file):
        urls: List[str] = []
        for line in Path(args.list_file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
        if urls:
            return urls
    raise SystemExit("Keine URL angegeben (--single-url oder --list-file).")


def build_session_filename(payload: Dict[str, Any]) -> str:
    sess = payload.get("session", {})
    lp = sess.get("legislative_period")
    num = sess.get("number")
    date = sess.get("date")
    if lp and num and date:
        return f"session_{lp}_{num}_{date}.json"
    if num and date:
        return f"session_{num}_{date}.json"
    if num:
        return f"session_{num}.json"
    url = (sess.get("source_pdf_url") or "").encode("utf-8")
    short = hashlib.sha256(url).hexdigest()[:8] if url else "na"
    return f"session_unknown_{short}.json"


def _find_first_body_speech_index(speeches: List[Dict[str, Any]], pattern: str) -> int:
    """
    Scans the speech segments for the first speech that matches the body-start pattern.
    Returns the index of that speech or 0 if not found.
    The matching is tolerant: checks start of speech text and speaker fields if present.
    """
    rx = re.compile(pattern, flags=re.IGNORECASE)
    for i, s in enumerate(speeches):
        # There are different possible shapes for a speech segment; be permissive:
        text = s.get("text", "")
        speaker = s.get("speaker", "") if isinstance(s.get("speaker", ""), str) else ""
        # Prefer checking explicit speaker field first
        if speaker and rx.match(speaker.strip()):
            return i
        # Otherwise check the beginning of the text (first ~120 chars)
        head = text.strip().splitlines()[0] if text and isinstance(text, str) else ""
        if rx.match(head):
            return i
        # Some segments present as list of text segments
        if isinstance(s.get("segments"), list):
            for seg in s["segments"]:
                seg_text = seg.get("text", "") if isinstance(seg, dict) else (seg if isinstance(seg, str) else "")
                if rx.match(seg_text.strip().splitlines()[0] if seg_text else ""):
                    return i
    return 0


def process_pdf(url: str,
                force_download: bool,
                layout_min_peak_sep: float,
                layout_min_valley_drop: float,
                externalize_layout_debug: bool = True,
                use_new_toc: bool = True,
                body_start_pattern: str = r'^(Präsident(?:in)?|Vorsitz(?:ender|ende)|Präsident\.)\b.*:') -> Dict[str, Any]:
    pdf_path = download_pdf(url, force=force_download)

    pages_lines, layout_debug = extract_pages_with_layout(
        str(pdf_path),
        force_two_column=True,
        min_words_for_detection=20,
        min_side_fraction=0.08,
        hist_bins=70,
        min_peak_separation_rel=layout_min_peak_sep,
        min_valley_rel_drop=layout_min_valley_drop,
        line_y_quant=3.0,
        rebalance_target_low=0.44,
        rebalance_target_high=0.56,
        rebalance_scan_step=5.0
    )

    pages_lines = remove_repeated_headers_footers(pages_lines)
    pages_lines, footer_stats = clean_page_footers(pages_lines)

    normalized_pages: List[List[str]] = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if l.strip()]
        lines = dehyphenate(lines)
        normalized_pages.append(lines)

    flat = flatten_pages(normalized_pages)
    all_text = "\n".join(l["text"] for l in flat)

    meta = parse_session_info(all_text)

    # Bisherige TOC-Ermittlung (beibehalten für Backward-Compatibility)
    toc_full = parse_toc(normalized_pages[0]) if normalized_pages else []
    toc_parts = partition_toc(toc_full)

    # Neue TOC-Struktur via neuer Parser-Pipeline (strukturierte items)
    toc2: Dict[str, Any] = {}
    if use_new_toc and parse_protocol_new is not None:
        try:
            toc_bundle = parse_protocol_new(
                flat,
                capture_offsets=False,
                debug=False,
                require_bold_for_header=False,
                allow_abg_without_party=True,
                fallback_inline_header=True,
                compact_interjections=True,
                include_interjection_category=False,
                externalize_interjection_offsets=False,
                stop_toc_at_first_body_header=True
            )
            if isinstance(toc_bundle, dict):
                toc2 = toc_bundle.get("toc", {}) or toc_bundle.get("items", {}) or {}
            else:
                toc2 = toc_bundle or {}
        except Exception as e:
            print(f"[WARN] Neuer TOC-Parser fehlgeschlagen: {e}")

    speeches = segment_speeches(flat)

    # --- Neuer Schritt: alles vor der ersten echten Rede abschneiden ---
    removed_before = 0
    try:
        first_idx = _find_first_body_speech_index(speeches, body_start_pattern)
        if first_idx > 0:
            removed_before = first_idx
            speeches = speeches[first_idx:]
            print(f"[INFO] Entferne {removed_before} vorläufige Segmente (TOC/Deckblatt). Erste Rede erkannt bei Index {first_idx}.")
    except Exception as e:
        print(f"[WARN] Fehler bei Erkennung des Body-Starts: {e}")

    interjection_stats = cleanup_interjections(speeches)

    reflow_stats = reflow_speeches(speeches, min_merge_len=35, keep_original=True)

    build_speech_segments(speeches,
                          renormalize_text_segments=True,
                          merge_adjacent_text=True,
                          numbering_mode="all")

    inline_agenda = extract_agenda(flat)
    link_agenda(inline_agenda, speeches)

    # Falls der neue TOC strukturiert eine Agenda liefert, nutze sie als toc_agenda
    final_toc_agenda = toc_parts["agenda"]
    if toc2:
        # try common keys in structured toc
        if isinstance(toc2, dict):
            # flexible heuristics: toc2 may contain 'agenda', 'items' or a list of nodes
            if toc2.get("agenda"):
                final_toc_agenda = toc2["agenda"]
            elif toc2.get("items"):
                final_toc_agenda = toc2["items"]
            else:
                # If toc2 itself is a list/sequence, use it directly
                if isinstance(toc2, list):
                    final_toc_agenda = toc2
        elif isinstance(toc2, list):
            final_toc_agenda = toc2

    payload: Dict[str, Any] = {
        "session": {
            "number": meta.get("number"),
            "legislative_period": meta.get("legislative_period"),
            "date": meta.get("date"),
            "source_pdf_url": url,
            "extracted_at": datetime.datetime.utcnow().isoformat() + "Z"
        },
        "sitting": {
            "start_time": meta.get("start_time"),
            "end_time": meta.get("end_time"),
            "location": meta.get("location")
        },
        "stats": {
            "pages": len(pages_lines),
            "speeches": len(speeches)
        },
        "layout": {
            "applied": True,
            "reason": "forced-always"
        },
        # Alte TOC-Felder (bestehende Konsumenten bleiben funktionsfähig)
        "toc": toc_full,
        # replace or augment toc_agenda with structured agenda if available
        "toc_agenda": final_toc_agenda,
        "toc_speakers": toc_parts["speakers"],
        "toc_other": toc_parts["other"],
        # Neue, strukturierte TOC-Ausgabe des verbesserten Parsers
        "toc2": toc2,
        "agenda_items": inline_agenda,
        "speeches": speeches,
        "cleanup_stats": {
            "footers": footer_stats,
            "interjections": interjection_stats,
            "reflow": reflow_stats,
            "removed_prelude_speeches": removed_before
        }
    }

    if externalize_layout_debug:
        payload["schema_version"] = "1.2-split-layout"
        base_name = build_session_filename(payload)
        layout_filename = base_name.replace(".json", ".layout.json")
        payload["layout_debug_file"] = layout_filename
        payload["_layout_debug_internal"] = layout_debug
    else:
        payload["schema_version"] = "1.1-full"
        payload["layout_debug"] = layout_debug

    return payload


def write_index(results: List[Dict[str, Any]], out_dir: Path):
    index = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "sessions": []
    }
    for r in results:
        fname = build_session_filename(r)
        session_entry = {
            "legislative_period": r["session"].get("legislative_period"),
            "number": r["session"].get("number"),
            "date": r["session"].get("date"),
            "file": fname,
            "speeches": r["stats"]["speeches"],
            "pages": r["stats"]["pages"],
            "layout_applied": r["layout"]["applied"],
            "layout_reason": r["layout"]["reason"],
            "source_pdf_url": r["session"]["source_pdf_url"]
        }
        if r.get("layout_debug_file"):
            session_entry["layout_debug_file"] = r["layout_debug_file"]
        index["sessions"].append(session_entry)

    with open(out_dir / "sessions_index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print("[INFO] Index aktualisiert.")


def write_session_payload(payload: Dict[str, Any], out_dir: Path) -> Path:
    """
    Schreibt die Haupt-Session-Datei und – falls ausgelagert – die Layout-Debug Sidecar-Datei.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    base_name = build_session_filename(payload)
    session_path = out_dir / base_name

    layout_debug_internal = payload.pop("_layout_debug_internal", None)
    layout_debug_file = payload.get("layout_debug_file")

    if layout_debug_file and layout_debug_internal is not None:
        sidecar_path = out_dir / layout_debug_file
        sidecar_doc = {
            "session_ref": base_name,
            "schema_version": "1.0-layout-debug",
            "layout_debug": layout_debug_internal
        }
        with sidecar_path.open("w", encoding="utf-8") as sf:
            json.dump(sidecar_doc, sf, ensure_ascii=False, indent=2)

    with session_path.open("w", encoding="utf-8") as mf:
        json.dump(payload, mf, ensure_ascii=False, indent=2)

    return session_path


def main() -> int:
    args = parse_args()
    urls = gather_urls(args)
    out_dir = Path("data")
    out_dir.mkdir(exist_ok=True)
    results: List[Dict[str, Any]] = []

    for url in urls:
        print(f"[INFO] Verarbeite {url} (layout=always, cleanup aktiv)")
        payload = process_pdf(
            url,
            force_download=args.force_download,
            layout_min_peak_sep=args.layout_min_peak_sep,
            layout_min_valley_drop=args.layout_min_valley_drop,
            externalize_layout_debug=True,  # Standard: ausgelagerte layout_debug
            use_new_toc=not args.no_new_toc,
            body_start_pattern=args.body_start_pattern
        )

        if args.schema_validate:
            try:
                validate_payload(payload)
            except Exception as e:
                print(f"[WARN] Schema-Validierung fehlgeschlagen: {e}")

        results.append(payload)
        spath = write_session_payload(payload, out_dir)
        print(f"[INFO] geschrieben: {spath.name} (layout_debug {'ausgelagert' if payload.get('layout_debug_file') else 'inline'})")

    if results:
        write_index(results, out_dir)

    return 0


if __name__ == "__main__":
    sys.exit(main())

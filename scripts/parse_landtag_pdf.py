#!/usr/bin/env python3
"""
parse_landtag_pdf.py

Pipeline zum Herunterladen und Parsen eines Landtagsprotokolls.
Schritte:

1. Download PDF (Cache steuerbar via --force-download)
2. Layout-Extraktion (Zwei-Spalten-Erkennung + Rebalancing)
3. Entfernen wiederholter Header / Footer (generisch)
4. Spezifische Footer-/Schluss-/Seitennummer-Bereinigung
5. Normalisierung + Dehyphenation
6. Flatten für Segmentierung / Agenda
7. Metadaten extrahieren
8. TOC parsen & partitionieren
9. Segmentierung in Reden
10. Interjection-Cleanup (extrahiert + Offsets)
11. Reflow (Absatzbildung)
12. Bau von Segmenten (Text/Interjections im Fluss)
13. Inline-Agenda extrahieren + Verknüpfung
14. Payload bauen (inkl. Debug & Cleanup Stats)
15. Optional: Schema-Validierung
16. Schreiben JSON + Index

Ausgabe: data/session_<...>.json & data/sessions_index.json
"""

import argparse
import json
import os
import sys
import datetime
import hashlib
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


def process_pdf(url: str,
                force_download: bool,
                layout_min_peak_sep: float,
                layout_min_valley_drop: float,
                externalize_layout_debug: bool = True) -> Dict[str, Any]:
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
    if parse_protocol_new is not None:
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
            toc2 = toc_bundle.get("toc", {}) or {}
        except Exception as e:
            print(f"[WARN] Neuer TOC-Parser fehlgeschlagen: {e}")

    speeches = segment_speeches(flat)

    interjection_stats = cleanup_interjections(speeches)

    reflow_stats = reflow_speeches(speeches, min_merge_len=35, keep_original=True)

    build_speech_segments(speeches,
                          renormalize_text_segments=True,
                          merge_adjacent_text=True,
                          numbering_mode="all")

    inline_agenda = extract_agenda(flat)
    link_agenda(inline_agenda, speeches)

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
        "toc_agenda": toc_parts["agenda"],
        "toc_speakers": toc_parts["speakers"],
        "toc_other": toc_parts["other"],
        # Neue, strukturierte TOC-Ausgabe des verbesserten Parsers
        "toc2": toc2,
        "agenda_items": inline_agenda,
        "speeches": speeches,
        "cleanup_stats": {
            "footers": footer_stats,
            "interjections": interjection_stats,
            "reflow": reflow_stats
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
            externalize_layout_debug=True  # Standard: ausgelagerte layout_debug
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

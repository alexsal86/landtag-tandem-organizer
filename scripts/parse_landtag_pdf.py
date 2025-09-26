#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_landtag_pdf.py
Kernausgabe: erzeugt das Session-Payload mit 'speeches' (segments) und optional
einem Layout-Sidecar (normalized_pages). Erzeugt standardmäßig KEINE heavy
Annotations (NER, Topic, etc.). Wenn Du Annotationen brauchst, nutze das
separate CLI scripts/export_annotations.py (on-demand).
Verhalten:
- default: keine heavy annotations
- optional: --include-light-annotations erzeugt sehr leichte, strukturierte Felder
  (z.B. normalized_speaker) inline in payload (klein, harmlos).
NEU:
- Verwendet parse_protocol_with_toc aus segment.py für verbessertes TOC-Parsing,
  das TOPs mit Rednern und Beschlüssen gruppiert.
- Fügt toc_structured zum Payload hinzu, wenn use_new_toc=True.
- Import von segment_page statt segment_speeches für Rede-Segmentierung.
- Hinzugefügt: import pdfplumber für direkten Seiten-Zugriff.
- Fix: Fügt start_page-Feld zu speeches hinzu, um KeyError in link_agenda zu vermeiden.
- Fix: Fügt index-Feld zu speeches hinzu, um KeyError in link_agenda zu vermeiden.
"""
from __future__ import annotations
import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import pdfplumber
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from parser_core.downloader import download_pdf
from parser_core.layout import extract_pages_with_layout
from parser_core.pdftext import remove_repeated_headers_footers, flatten_pages
from parser_core.normalize import normalize_line, dehyphenate
from parser_core.segment import segment_page, parse_protocol_with_toc
from parser_core.agenda import extract_agenda, link_agenda
from parser_core.metadata import parse_session_info
from parser_core.schema_def import validate_payload
from parser_core.toc import parse_toc, partition_toc
from parser_core.cleanup import clean_page_footers, cleanup_interjections
from parser_core.textflow import reflow_speeches
from parser_core.segments import build_speech_segments

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

def clean_leader_and_page(s: str) -> str:
    if not isinstance(s, str):
        return s
    s = s.strip()
    if not s:
        return s
    # remove long dot sequences and trailing page numbers conservatively
    s = re.sub(r"\.{2,}", " ", s)
    s = s.replace("…", " ")
    s = re.sub(r"\s+\d{1,5}[.,]?$", "", s)
    s = re.sub(r"[.,\-\u2013\u2014\—\–\s]+$", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s or s

def _find_first_body_speech_index(speeches: List[Dict[str, Any]], pattern: str) -> int:
    rx = re.compile(pattern, flags=re.IGNORECASE)
    for i, s in enumerate(speeches):
        if not isinstance(s, dict):
            continue
        speaker = s.get("speaker", "")
        if isinstance(speaker, str) and speaker.strip() and rx.match(speaker.strip()):
            return i
        text = s.get("text", "")
        if isinstance(text, str) and text.strip():
            head = text.strip().splitlines()[0]
            if rx.match(head):
                return i
    return 0

def process_pdf(
    url: str,
    force_download: bool,
    layout_min_peak_sep: float,
    layout_min_valley_drop: float,
    externalize_layout_debug: bool = True,
    include_light_annotations: bool = False,
    use_new_toc: bool = True,
    body_start_pattern: str = r"^(Präsident(?:in)?|Vorsitz(?:ender|ende)|Präsident\.)\b.*:",
) -> Dict[str, Any]:
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
        rebalance_scan_step=5.0,
    )
    pages_lines = remove_repeated_headers_footers(pages_lines)
    pages_lines, footer_stats = clean_page_footers(pages_lines)
    normalized_pages: List[List[str]] = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if isinstance(l, str) and l.strip()]
        lines = dehyphenate(lines)
        normalized_pages.append(lines)
    flat = flatten_pages(normalized_pages)
    all_text = "\n".join(l["text"] for l in flat)
    meta = parse_session_info(all_text)
    # Legacy TOC
    toc_full = parse_toc(normalized_pages[0]) if normalized_pages else []
    toc_parts = partition_toc(toc_full)
    # Neue TOC-Logik (gruppiert TOPs mit Rednern/Beschlüssen)
    toc_structured = {}
    if use_new_toc:
        try:
            result = parse_protocol_with_toc(
                pdf_path,
                parse_toc=True,
                capture_offsets=False,
                compact_interjections=True,
                include_interjection_category=False,
                externalize_interjection_offsets=False,
                fallback_inline_header=True
            )
            toc_structured = result.get("toc_segments", [])
            # Optional: Speeches aus neuer Logik, falls segment_page ersetzt werden soll
            # speeches = result.get("speeches", speeches)
        except Exception as e:
            print(f"[WARN] Neue TOC-Verarbeitung fehlgeschlagen: {e}")
            toc_structured = {}
    # Speeches (using segment_page instead of segment_speeches)
    speeches = []
    for page in pdfplumber.open(pdf_path).pages:
        result = segment_page(
            page,
            capture_offsets=True,
            compact_interjections=True,
            include_interjection_category=False,
            externalize_interjection_offsets=False,
            fallback_inline_header=True
        )
        if isinstance(result, tuple):
            page_speeches, _ = result
        else:
            page_speeches = result
        # Füge start_page-Feld hinzu, um KeyError in link_agenda zu vermeiden
        for speech in page_speeches:
            speech["start_page"] = speech.get("page")
        speeches.extend(page_speeches)
    # Füge index-Feld hinzu, um KeyError in link_agenda zu vermeiden
    for i, speech in enumerate(speeches):
        speech["index"] = i
    # Trim prelude until first body-speech
    removed_before = 0
    try:
        first_idx = _find_first_body_speech_index(speeches, body_start_pattern)
        if first_idx > 0:
            removed_before = first_idx
            speeches = speeches[first_idx:]
    except Exception:
        pass
    interjection_stats = cleanup_interjections(speeches)
    reflow_stats = reflow_speeches(speeches, min_merge_len=35, keep_original=True)
    build_speech_segments(speeches, renormalize_text_segments=True, merge_adjacent_text=True, numbering_mode="all")
    inline_agenda = extract_agenda(flat)
    link_agenda(inline_agenda, speeches)
    # Prepare layout sidecar internal (normalized pages + metadata)
    layout_debug_internal = {
        "layout_metadata": layout_debug,
        "normalized_pages": normalized_pages,
        "raw_pages_lines": pages_lines,
    }
    payload: Dict[str, Any] = {
        "session": {
            "number": meta.get("number"),
            "legislative_period": meta.get("legislative_period"),
            "date": meta.get("date"),
            "source_pdf_url": url,
            "extracted_at": datetime.datetime.utcnow().isoformat() + "Z",
        },
        "sitting": {
            "start_time": meta.get("start_time"),
            "end_time": meta.get("end_time"),
            "location": meta.get("location"),
        },
        "stats": {"pages": len(pages_lines), "speeches": len(speeches)},
        "layout": {"applied": True, "reason": "forced-always"},
        # Legacy TOC
        "toc": toc_full,
        "toc_agenda": toc_parts.get("agenda", []) if isinstance(toc_parts, dict) else [],
        "toc_speakers": toc_parts.get("speakers", []) if isinstance(toc_parts, dict) else [],
        "toc_other": toc_parts.get("other", []) if isinstance(toc_parts, dict) else [],
        # Neue TOC-Struktur
        "toc_structured": toc_structured,
        "agenda_items": inline_agenda,
        "speeches": speeches,
        "cleanup_stats": {
            "footers": footer_stats,
            "interjections": interjection_stats,
            "reflow": reflow_stats,
            "removed_prelude_speeches": removed_before,
        },
    }
    # Light inline annotations (only if explicitly requested)
    if include_light_annotations:
        for i, s in enumerate(speeches):
            speaker = s.get("speaker") if isinstance(s.get("speaker"), str) else None
            if speaker:
                payload.setdefault("light_annotations", []).append(
                    {
                        "id": f"la-speaker-{i}",
                        "segment_index": i,
                        "type": "speaker_normalized",
                        "value": clean_leader_and_page(speaker),
                        "source": "heuristic",
                        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                    }
                )
    # Attach layout sidecar info either inline or external
    if externalize_layout_debug:
        payload["schema_version"] = "1.2-split-layout"
        base_name = build_session_filename(payload)
        layout_filename = base_name.replace(".json", ".layout.json")
        payload["layout_debug_file"] = layout_filename
        payload["_layout_debug_internal"] = layout_debug_internal
    else:
        payload["schema_version"] = "1.1-full"
        payload["layout_debug"] = layout_debug_internal
    return payload

def write_session_payload(payload: Dict[str, Any], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    base_name = build_session_filename(payload)
    session_path = out_dir / base_name
    layout_debug_internal = payload.pop("_layout_debug_internal", None)
    layout_debug_file = payload.get("layout_debug_file")
    if not layout_debug_file and layout_debug_internal is not None:
        layout_filename = base_name.replace(".json", ".layout.json")
        payload["layout_debug_file"] = layout_filename
    # Write sidecar if present
    if layout_debug_internal is not None:
        sidecar_path = out_dir / layout_debug_file
        sidecar_doc = {"session_ref": base_name, "schema_version": "1.0-layout-debug", "layout_debug": layout_debug_internal}
        with sidecar_path.open("w", encoding="utf-8") as sf:
            json.dump(sidecar_doc, sf, ensure_ascii=False, indent=2)
        print(f"[INFO] layout sidecar written: {sidecar_path.name}")
    # Write main payload (without internal blob)
    with session_path.open("w", encoding="utf-8") as mf:
        json.dump(payload, mf, ensure_ascii=False, indent=2)
    print(f"[INFO] session payload written: {session_path.name}")
    return session_path

def parse_args():
    ap = argparse.ArgumentParser(description="Parst ein Landtags-PDF und erzeugt strukturierte JSON-Ausgabe (speaker segments).")
    ap.add_argument("--list-file", help="Datei mit Zeilenweise URLs (optional).")
    ap.add_argument("--single-url", help="Einzelne PDF-URL.")
    ap.add_argument("--schema-validate", action="store_true", help="Schema-Validierung aktivieren.")
    ap.add_argument("--force-download", action="store_true", help="PDF erneut herunterladen, auch wenn im Cache.")
    ap.add_argument("--layout-min-peak-sep", type=float, default=0.18)
    ap.add_argument("--layout-min-valley-drop", type=float, default=0.30)
    ap.add_argument("--no-new-toc", action="store_true", help="Deaktiviert neuen TOC-Parser.")
    ap.add_argument("--include-light-annotations", action="store_true", help="Erzeuge nur sehr kleine inline Annotations (safe).")
    ap.add_argument("--body-start-pattern", default=r"^(Präsident(?:in)?|Vorsitz(?:ender|ende)|Präsident\.)\b.*:")
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

def main() -> int:
    args = parse_args()
    urls = gather_urls(args)
    out_dir = Path("data")
    out_dir.mkdir(exist_ok=True)
    results: List[Dict[str, Any]] = []
    for url in urls:
        print(f"[INFO] Verarbeite {url}")
        payload = process_pdf(
            url,
            force_download=args.force_download,
            layout_min_peak_sep=args.layout_min_peak_sep,
            layout_min_valley_drop=args.layout_min_valley_drop,
            externalize_layout_debug=True,
            include_light_annotations=args.include_light_annotations,
            use_new_toc=not args.no_new_toc,
            body_start_pattern=args.body_start_pattern,
        )
        if args.schema_validate:
            try:
                validate_payload(payload)
            except Exception as e:
                print(f"[WARN] Schema-Validierung fehlgeschlagen: {e}")
        results.append(payload)
        spath = write_session_payload(payload, out_dir)
        print(f"[INFO] geschrieben: {spath.name}")
    if results:
        # Build a small index
        index = {"generated_at": datetime.datetime.utcnow().isoformat() + "Z", "sessions": []}
        for r in results:
            fname = build_session_filename(r)
            session_entry = {
                "legislative_period": r["session"].get("legislative_period"),
                "number": r["session"].get("number"),
                "date": r["session"].get("date"),
                "file": fname,
                "speeches": r["stats"]["speeches"],
                "pages": r["stats"]["pages"],
                "source_pdf_url": r["session"]["source_pdf_url"],
            }
            if r.get("layout_debug_file"):
                session_entry["layout_debug_file"] = r["layout_debug_file"]
            index["sessions"].append(session_entry)
        with open(out_dir / "sessions_index.json", "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print("[INFO] Index aktualisiert.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

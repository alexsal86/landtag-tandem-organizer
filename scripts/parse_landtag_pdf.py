#!/usr/bin/env python3
"""
parse_landtag_pdf.py

Pipeline zum Herunterladen und Parsen eines Landtagsprotokolls.

Wesentliche Punkte:
- Erzeugt jetzt wieder ein Layout-Sidecar, das neben den Layout-Metadaten
  auch die normalisierten Zeilen der einzelnen Seiten enthält (normalized_pages).
  Damit kannst Du die TOC‑Heuristiken genau an den extrahierten Linien testen.
- Alte Felder und Ausgabeformate bleiben kompatibel (toc, toc_agenda, toc2).
- Die Sidecar wird standardmäßig ausgelagert (externalize_layout_debug=True).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import datetime
import hashlib
import re
from pathlib import Path
from typing import List, Dict, Any, Union, Optional

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

# Optionaler, neuer TOC-Parser (wenn vorhanden)
try:
    from scripts.parser_core.pipeline import parse_protocol as parse_protocol_new  # type: ignore
except Exception:
    parse_protocol_new = None  # fallback auf None


# -------------------- Cleaning helpers --------------------

DOT_MARKER = "\x07"  # temporary marker for long dot sequences


def _replace_long_dot_sequences(s: str) -> str:
    if not isinstance(s, str):
        return s
    s = re.sub(r"\.{2,}", DOT_MARKER, s)  # two or more ascii dots -> marker
    s = s.replace("…", DOT_MARKER)  # unicode ellipsis -> marker
    return s


def clean_leader_and_page(s: str) -> str:
    if not isinstance(s, str):
        return s
    orig = s
    s = s.strip()
    if not s:
        return s

    s = _replace_long_dot_sequences(s)

    s = re.sub(rf"{DOT_MARKER}\s*\d{{1,5}}[.,]?$", "", s)
    s = re.sub(r"\s+\d{1,5}[.,]?$", "", s)

    s = s.replace(DOT_MARKER, " ")
    s = re.sub(r"\.{2,}", " ", s)
    s = s.replace("…", " ")

    s = re.sub(r"[.,\-\u2013\u2014\—\–\s]+$", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip()

    if not s:
        return orig.strip()
    return s


def clean_toc_agenda_list(lst: List[str]) -> List[str]:
    if not isinstance(lst, list):
        return lst
    out: List[str] = []
    for line in lst:
        if not isinstance(line, str):
            out.append(line)
            continue
        cleaned = clean_leader_and_page(line)
        if out:
            prev = out[-1]
            if len(cleaned) < 40 and cleaned and (cleaned[0].islower() or cleaned[0].isdigit()):
                out[-1] = prev + " " + cleaned
                continue
            if prev.endswith("-"):
                out[-1] = prev.rstrip("-") + cleaned
                continue
        out.append(cleaned)
    return out


def _clean_string_fields_in_obj(obj: Any) -> Any:
    if isinstance(obj, str):
        return clean_leader_and_page(obj)
    if isinstance(obj, list):
        return [_clean_string_fields_in_obj(x) for x in obj]
    if isinstance(obj, dict):
        cleaned: Dict[str, Any] = {}
        for k, v in obj.items():
            lk = k.lower()
            if lk in ("title", "text", "label", "name", "speaker", "heading"):
                if isinstance(v, str):
                    cleaned[k] = clean_leader_and_page(v)
                else:
                    cleaned[k] = _clean_string_fields_in_obj(v)
            elif lk in ("speakers", "participants", "authors"):
                if isinstance(v, list):
                    cleaned[k] = [clean_leader_and_page(x) if isinstance(x, str) else _clean_string_fields_in_obj(x) for x in v]
                else:
                    cleaned[k] = _clean_string_fields_in_obj(v)
            elif lk in ("items", "children", "nodes", "agenda", "entries"):
                cleaned[k] = _clean_string_fields_in_obj(v)
            else:
                if isinstance(v, (dict, list)):
                    cleaned[k] = _clean_string_fields_in_obj(v)
                else:
                    cleaned[k] = v
        return cleaned
    return obj


def clean_toc2_structure(obj: Any) -> Any:
    try:
        return _clean_string_fields_in_obj(obj)
    except Exception as e:
        print(f"[WARN] toc2 cleaning failed: {e}")
        return obj


# -------------------- Body-start detection --------------------


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
        if isinstance(s.get("segments"), list):
            for seg in s["segments"]:
                seg_text = seg.get("text") if isinstance(seg, dict) else (seg if isinstance(seg, str) else "")
                if seg_text and rx.match(seg_text.strip().splitlines()[0]):
                    return i
    return 0


# -------------------- TOC helpers --------------------


def _find_line_index_for_item(raw_lines: List[str], snippet: str) -> int:
    if not snippet:
        return -1
    snippet = snippet.strip()[:40].lower()
    for i, ln in enumerate(raw_lines):
        if not isinstance(ln, str):
            continue
        if snippet in ln.lower():
            return i
    return -1


def _is_probable_speaker_line(ln: str) -> bool:
    if not ln or not isinstance(ln, str):
        return False
    s = ln.strip()
    if re.search(r'\bDrucksache\b', s, flags=re.IGNORECASE):
        return False
    if re.search(r'\b(Der Landtag|druckt|Recyclingpapier|Umweltzeichen|Blaue Engel)\b', s, flags=re.IGNORECASE):
        return False
    if re.match(r'^(Abg\.|Abg|Staatssekretärin|Staatssekretär|Staatsministerin|Staatsminister|Ministerin|Minister|Präsidentin|Präsident|Dr\.|Prof\.)', s, flags=re.IGNORECASE):
        return True
    if re.search(r'\b(AfD|GRÜNE|GRUENE|SPD|CDU|FDP|DVP|FDP/DVP|BÜNDNIS|Bündnis)\b', s, flags=re.IGNORECASE):
        if re.search(r'\b[A-ZÄÖÜ][a-zäöüß\-]{2,}\s+[A-ZÄÖÜ][a-zäöüß\-]{2,}\b', s):
            return True
    if len(s) < 80 and re.search(r'\b[A-ZÄÖÜ][a-zäöüß\-]{2,}\s+[A-ZÄÖÜ][a-zäöüß\-]{2,}\b', s):
        return True
    return False


def _extract_speakers_after_index(raw_lines: List[str], start_idx: int, stop_at_indices: set) -> List[str]:
    speakers: List[str] = []
    n = len(raw_lines)
    i = start_idx + 1
    agenda_start_rx = re.compile(r'^\s*(\d+\.)|\bBeschluss\b|\bZweite Beratung\b', re.IGNORECASE)
    while i < n:
        if i in stop_at_indices:
            break
        ln = (raw_lines[i] or "").strip()
        if not ln:
            break
        if agenda_start_rx.search(ln):
            break
        if _is_probable_speaker_line(ln):
            speakers.append(clean_leader_and_page(ln))
            i += 1
            if i < n:
                peek = (raw_lines[i] or "").strip()
                if peek and _is_probable_speaker_line(peek):
                    continue
                if peek and len(peek) < 80 and re.search(r'\b[A-ZÄÖÜ][a-zäöüß\-]{2,}\b', peek):
                    speakers[-1] = speakers[-1] + " " + clean_leader_and_page(peek)
                    i += 1
                    continue
            continue
        break
    return speakers


# -------------------- Argument parsing --------------------


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


# -------------------- Filename helper --------------------


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


# -------------------- Main processing --------------------


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

    # normalize and dehyphenate -> these are the text lines you requested
    normalized_pages: List[List[str]] = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if l.strip()]
        lines = dehyphenate(lines)
        normalized_pages.append(lines)

    flat = flatten_pages(normalized_pages)
    all_text = "\n".join(l["text"] for l in flat)

    meta = parse_session_info(all_text)

    # Legacy TOC extraction (kept for compatibility)
    toc_full = parse_toc(normalized_pages[0]) if normalized_pages else []
    toc_parts = partition_toc(toc_full)

    # Optional: structured TOC via new parser pipeline
    toc2: Any = {}
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
                toc2 = toc_bundle.get("toc") or toc_bundle.get("items") or toc_bundle
            else:
                toc2 = toc_bundle or {}
        except Exception as e:
            print(f"[WARN] Neuer TOC-Parser fehlgeschlagen: {e}")
            toc2 = {}

    # Build a cleaned agenda (legacy toc parts -> lines)
    raw_agenda_lines: List[str] = []
    toc_agenda_items_raw: List[Dict[str, Any]] = []
    if isinstance(toc_parts, dict):
        for it in toc_parts.get("agenda", []):
            if isinstance(it, dict):
                raw_val = it.get("raw") or it.get("title") or ""
                toc_agenda_items_raw.append(it)
            else:
                raw_val = str(it)
                toc_agenda_items_raw.append({"raw": raw_val, "title": raw_val})
            raw_agenda_lines.append(raw_val)

    cleaned_agenda_lines = clean_toc_agenda_list(raw_agenda_lines)

    # Clean structured toc2 if present
    cleaned_toc2 = toc2
    if toc2:
        try:
            cleaned_toc2 = clean_toc2_structure(toc2)
        except Exception as e:
            print(f"[WARN] Fehler beim Säubern von toc2: {e}")
            cleaned_toc2 = toc2

    # Raw TOC page lines for speaker extraction
    raw_toc_page_lines: List[str] = normalized_pages[0] if normalized_pages and isinstance(normalized_pages[0], list) else []

    # stop indices: positions of recognized raw agenda lines on the page
    stop_indices = set()
    for raw in raw_agenda_lines:
        idx = _find_line_index_for_item(raw_toc_page_lines, raw)
        if idx >= 0:
            stop_indices.add(idx)

    # Build cleaned agenda items from toc_parts, attach speakers where reasonable
    cleaned_agenda_items: List[Dict[str, Any]] = []
    for orig_item in toc_agenda_items_raw:
        raw = orig_item.get("raw") or ""
        title = orig_item.get("title") or raw
        title_clean = clean_leader_and_page(title)

        if isinstance(title_clean, str) and re.search(r'Drucksache\s*\d+\/\s*$', title_clean):
            num = orig_item.get("page_in_pdf")
            if num:
                title_clean = title_clean.rstrip('/ ') + "/" + str(num)
                try:
                    docnum = re.search(r'Drucksache\s*(\d+)', title_clean).group(1)
                    orig_item["docket"] = f"{docnum}/{num}"
                except Exception:
                    orig_item["docket"] = f"{num}"

        speakers: List[str] = []
        idx = _find_line_index_for_item(raw_toc_page_lines, raw or title)
        if idx >= 0:
            try:
                speakers = _extract_speakers_after_index(raw_toc_page_lines, idx, stop_indices)
            except Exception as e:
                print(f"[WARN] Fehler beim Extrahieren von Sprechern für TOC-Item '{title}': {e}")
                speakers = []

        cleaned_item: Dict[str, Any] = {
            "raw": raw,
            "title": title_clean,
            "index": orig_item.get("index"),
            "numbered": orig_item.get("numbered", False),
            "type": orig_item.get("type", "agenda"),
            "page_in_pdf": orig_item.get("page_in_pdf"),
            "docket": orig_item.get("docket"),
            "speakers": speakers,
        }
        cleaned_agenda_items.append(cleaned_item)

    # Build speeches and perform body-start trimming
    speeches = segment_speeches(flat)

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

    # Merge inline_agenda with TOC page items
    merged_agenda: List[Dict[str, Any]] = []
    if isinstance(inline_agenda, list) and inline_agenda:
        for ia in inline_agenda:
            title = ia.get("title") if isinstance(ia, dict) else str(ia)
            title_clean = clean_leader_and_page(title) if isinstance(title, str) else title
            merged_agenda.append({
                "code": ia.get("code") if isinstance(ia, dict) else None,
                "title": title_clean,
                "start_page": ia.get("start_page") if isinstance(ia, dict) else None,
                "speech_indices": ia.get("speech_indices") if isinstance(ia, dict) else None,
                "source": ia.get("source") if isinstance(ia, dict) else "inline",
                "speakers": [],
            })

    seen_titles = {entry["title"].lower() for entry in merged_agenda if isinstance(entry.get("title"), str)}
    for it in cleaned_agenda_items:
        t = it.get("title", "")
        if isinstance(t, str) and t.lower() in seen_titles:
            for ma in merged_agenda:
                if isinstance(ma.get("title"), str) and ma["title"].lower() == t.lower():
                    if it.get("speakers"):
                        ma["speakers"] = it.get("speakers")
                    if it.get("docket"):
                        ma["docket"] = it.get("docket")
                    if it.get("page_in_pdf"):
                        ma["page_in_pdf"] = it.get("page_in_pdf")
                    break
            continue
        merged_agenda.append({
            "title": t,
            "raw": it.get("raw"),
            "index": it.get("index"),
            "numbered": it.get("numbered"),
            "type": it.get("type"),
            "page_in_pdf": it.get("page_in_pdf"),
            "docket": it.get("docket"),
            "speakers": it.get("speakers", []),
            "source": "tocpage"
        })

    # Prefer structured toc2 if available and merge info by title
    final_toc_agenda: List[Any] = merged_agenda
    try:
        if cleaned_toc2:
            if isinstance(cleaned_toc2, dict) and cleaned_toc2.get("agenda"):
                candidate = cleaned_toc2["agenda"]
            elif isinstance(cleaned_toc2, dict) and cleaned_toc2.get("items"):
                candidate = cleaned_toc2["items"]
            elif isinstance(cleaned_toc2, list):
                candidate = cleaned_toc2
            else:
                candidate = None

            if candidate:
                normalized_final: List[Dict[str, Any]] = []
                for c in candidate:
                    if isinstance(c, dict):
                        title = c.get("title") or c.get("text") or c.get("label") or str(c)
                    else:
                        title = str(c)
                    title_clean = clean_leader_and_page(title) if isinstance(title, str) else title
                    entry = {
                        "title": title_clean,
                        "raw": c if not isinstance(c, dict) else c.get("raw", title),
                        "speakers": [],
                        "docket": c.get("docket") if isinstance(c, dict) else None,
                        "page_in_pdf": c.get("page_in_pdf") if isinstance(c, dict) else None,
                        "source": "toc2"
                    }
                    for m in merged_agenda:
                        if isinstance(m.get("title"), str) and isinstance(title_clean, str) and m["title"].lower() == title_clean.lower():
                            if m.get("speakers"):
                                entry["speakers"] = m["speakers"]
                            if m.get("docket"):
                                entry["docket"] = m.get("docket")
                            if m.get("page_in_pdf"):
                                entry["page_in_pdf"] = m.get("page_in_pdf")
                            break
                    normalized_final.append(entry)
                if normalized_final:
                    final_toc_agenda = normalized_final
    except Exception:
        final_toc_agenda = merged_agenda

    # ------------------ Important: prepare layout sidecar payload ------------------
    # Include both the layout metadata and the normalized page lines so you can inspect
    # and tune TOC heuristics without rerunning the whole extraction.
    layout_debug_internal = {
        "layout_metadata": layout_debug,         # as returned by extract_pages_with_layout
        "normalized_pages": normalized_pages,    # dehyphenated & normalized lines per page
        "raw_pages_lines": pages_lines           # raw lines per page before normalizing/dehyphenating
    }

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
        "toc": toc_full,
        "toc_agenda": final_toc_agenda,
        "toc_speakers": toc_parts.get("speakers", []) if isinstance(toc_parts, dict) else [],
        "toc_other": toc_parts.get("other", []) if isinstance(toc_parts, dict) else [],
        "toc2": cleaned_toc2,
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
        # attach the enriched layout debug (metadata + normalized page lines) for sidecar
        payload["_layout_debug_internal"] = layout_debug_internal
    else:
        payload["schema_version"] = "1.1-full"
        # if not externalizing, include the layout_debug inline (with normalized pages)
        payload["layout_debug"] = layout_debug_internal

    return payload


# -------------------- Output helpers --------------------


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
            # write the enriched layout debug which now contains normalized_pages
            "layout_debug": layout_debug_internal
        }
        with sidecar_path.open("w", encoding="utf-8") as sf:
            json.dump(sidecar_doc, sf, ensure_ascii=False, indent=2)

    with session_path.open("w", encoding="utf-8") as mf:
        json.dump(payload, mf, ensure_ascii=False, indent=2)

    return session_path


# -------------------- CLI entrypoint --------------------


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
            externalize_layout_debug=True,
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

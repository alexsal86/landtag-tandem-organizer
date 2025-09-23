#!/usr/bin/env python3
import argparse, json, os, sys, datetime, hashlib
from pathlib import Path

from parser_core.downloader import download_pdf
from parser_core.pdftext import remove_repeated_headers_footers, flatten_pages
from parser_core.normalize import normalize_line, dehyphenate
from parser_core.segment import segment_speeches
from parser_core.agenda import extract_agenda, link_agenda
from parser_core.metadata import parse_session_info
from parser_core.schema_def import validate_payload
from parser_core.toc import parse_toc, partition_toc
from parser_core.layout import extract_pages_with_layout  # <--- WICHTIGER IMPORT

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-file")
    ap.add_argument("--single-url")
    ap.add_argument("--schema-validate", action="store_true")
    ap.add_argument("--force-download", action="store_true")
    return ap.parse_args()

def gather_urls(args):
    if args.single_url:
        return [args.single_url.strip()]
    if args.list_file and os.path.isfile(args.list_file):
        urls = []
        for line in Path(args.list_file).read_text(encoding="utf-8").splitlines():
            line=line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
        if urls:
            return urls
    raise SystemExit("Keine URL angegeben (--single-url oder --list-file).")

def build_session_filename(payload: dict) -> str:
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

def process_pdf(url: str, force_download: bool):
    pdf_path = download_pdf(url, force=force_download)

    # Immer Layout / Zwei-Spalten-Verarbeitung erzwingen
    pages_lines, debug_meta = extract_pages_with_layout(
    str(pdf_path),
    force_two_column=True,
    min_words_for_detection=20,
    min_side_fraction=0.08,
    hist_bins=70,
    min_peak_separation_rel=0.18,
    min_valley_rel_drop=0.30,
    line_y_quant=3.0,
    rebalance_target_low=0.44,
    rebalance_target_high=0.56,
    rebalance_scan_step=5.0
)

    # Kopf-/Fußzeilen raus
    pages_lines = remove_repeated_headers_footers(pages_lines)

    # Normalisieren + Dehyphenate
    normalized_pages = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if l.strip()]
        lines = dehyphenate(lines)
        normalized_pages.append(lines)

    # Flatten für Segmentierung
    flat = flatten_pages(normalized_pages)
    all_text = "\n".join(l["text"] for l in flat)
    meta = parse_session_info(all_text)

    # TOC
    toc_full = parse_toc(normalized_pages[0]) if normalized_pages else []
    toc_parts = partition_toc(toc_full)

    # Reden
    speeches = segment_speeches(flat)

    # Inline Agenda + Linking
    inline_agenda = extract_agenda(flat)
    link_agenda(inline_agenda, speeches)

    payload = {
        "session": {
            "number": meta["number"],
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
        "layout_debug": debug_meta,            # <--- jetzt NIE null
        "toc": toc_full,
        "toc_agenda": toc_parts["agenda"],
        "toc_speakers": toc_parts["speakers"],
        "toc_other": toc_parts["other"],
        "agenda_items": inline_agenda,
        "speeches": speeches
    }
    return payload

def main():
    args = parse_args()
    urls = gather_urls(args)
    out_dir = Path("data")
    out_dir.mkdir(exist_ok=True)
    results = []
    for url in urls:
        print(f"[INFO] Verarbeite {url} (layout=always)")
        payload = process_pdf(url, args.force_download)
        if args.schema_validate:
            try:
                validate_payload(payload)
            except Exception as e:
                print(f"[WARN] Schema-Validierung fehlgeschlagen: {e}")
        results.append(payload)
        fname = build_session_filename(payload)
        with open(out_dir / fname, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"[INFO] geschrieben: {fname}")

    if results:
        index = {
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
            "sessions": []
        }
        for r in results:
            fname = build_session_filename(r)
            index["sessions"].append({
                "legislative_period": r["session"]["legislative_period"],
                "number": r["session"]["number"],
                "date": r["session"]["date"],
                "file": fname,
                "speeches": r["stats"]["speeches"],
                "pages": r["stats"]["pages"],
                "layout_applied": r["layout"]["applied"],
                "layout_reason": r["layout"]["reason"],
                "source_pdf_url": r["session"]["source_pdf_url"]
            })
        with open(out_dir / "sessions_index.json", "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print("[INFO] Index aktualisiert.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

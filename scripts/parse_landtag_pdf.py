#!/usr/bin/env python3
import argparse, json, os, sys, datetime, hashlib
from pathlib import Path

from parser_core.downloader import download_pdf
from parser_core.pdftext import extract_pages, remove_repeated_headers_footers, flatten_pages
from parser_core.normalize import normalize_line, dehyphenate
from parser_core.segment import segment_speeches
from parser_core.agenda import extract_agenda, link_agenda
from parser_core.metadata import parse_session_info
from parser_core.schema_def import validate_payload
from parser_core.toc import parse_toc

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-file")
    ap.add_argument("--single-url")
    ap.add_argument("--schema-validate", action="store_true")
    ap.add_argument("--log-level", default="INFO")
    ap.add_argument("--force-download", action="store_true")
    ap.add_argument("--skip-existing", action="store_true")
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
    pages_lines = extract_pages(pdf_path)
    pages_lines = remove_repeated_headers_footers(pages_lines)

    normalized_pages = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if l.strip()]
        lines = dehyphenate(lines)
        normalized_pages.append(lines)

    flat = flatten_pages(normalized_pages)
    all_text = "\n".join(l["text"] for l in flat)
    meta = parse_session_info(all_text)

    toc_items = []
    if normalized_pages:
        toc_items = parse_toc(normalized_pages[0])

    speeches = segment_speeches(flat)
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
        "toc": toc_items,
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
        print(f"[INFO] Verarbeite {url}")
        payload = process_pdf(url, args.force_download)
        if args.schema_validate:
            try:
                validate_payload(payload)
            except Exception as e:
                print(f"[WARN] Schema-Validierung fehlgeschlagen: {e}")
        results.append(payload)
        fname = build_session_filename(payload)
        out_file = out_dir / fname
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"[INFO] geschrieben: {out_file}")

    if results:
        # Index neu schreiben/aktualisieren
        index_path = out_dir / "sessions_index.json"
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
                "source_pdf_url": r["session"]["source_pdf_url"]
            })
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print(f"[INFO] Index aktualisiert: {index_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())

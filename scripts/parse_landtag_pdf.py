#!/usr/bin/env python3
"""
Echter Parser – Iteration 1–2:
- Lädt PDF (oder nutzt list-file)
- Extrahiert Text, entfernt Kopf/Fuß
- Segmentiert Reden mittels Regex
- Erkennt rudimentäre Agenda Items
- Schreibt JSON nach data/<sprechender Name>.json
Dateinamensschema (Priorität):
  session_<legislativePeriod>_<sessionNumber>_<date>.json
  session_<sessionNumber>_<date>.json
  session_<sessionNumber>.json
  session_unknown_<hash>.json
"""
import argparse, json, os, sys, datetime, hashlib
from pathlib import Path

from parser_core.downloader import download_pdf
from parser_core.pdftext import extract_pages, remove_repeated_headers_footers, flatten_pages
from parser_core.normalize import normalize_line, dehyphenate
from parser_core.segment import segment_speeches
from parser_core.agenda import extract_agenda, link_agenda
from parser_core.metadata import parse_session_info
from parser_core.schema_def import validate_payload


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-file")
    ap.add_argument("--single-url")
    ap.add_argument("--schema-validate", action="store_true")
    ap.add_argument("--log-level", default="INFO")
    ap.add_argument("--force-download", action="store_true")
    ap.add_argument("--skip-existing", action="store_true",
                    help="Falls Zieldatei schon existiert und gleiches PDF verarbeitet wurde, überspringen (TODO Hash-Prüfung).")
    return ap.parse_args()


def gather_urls(args):
    if args.single_url:
        return [args.single_url.strip()]
    if args.list_file and os.path.isfile(args.list_file):
        urls = []
        for line in Path(args.list_file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
        if urls:
            return urls
    raise SystemExit("Keine URL angegeben (--single-url oder --list-file).")


def build_session_filename(payload: dict) -> str:
    sess = payload.get("session", {})
    lp = sess.get("legislative_period")
    num = sess.get("number")
    date = sess.get("date")  # ISO (YYYY-MM-DD) oder None
    if lp and num and date:
        return f"session_{lp}_{num}_{date}.json"
    if num and date:
        return f"session_{num}_{date}.json"
    if num:
        return f"session_{num}.json"
    # Fallback mit stabiler, kurzer Hash-ID basierend auf URL
    url = (sess.get("source_pdf_url") or "").encode("utf-8")
    short = hashlib.sha256(url).hexdigest()[:8] if url else "na"
    return f"session_unknown_{short}.json"


def process_pdf(url: str, force_download: bool):
    pdf_path = download_pdf(url, force=force_download)
    pages_lines = extract_pages(pdf_path)
    pages_lines = remove_repeated_headers_footers(pages_lines)

    # Normalize + dehyphenate per page lines
    normalized_pages = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if l.strip()]
        lines = dehyphenate(lines)
        normalized_pages.append(lines)

    flat = flatten_pages(normalized_pages)
    all_text = "\n".join(l["text"] for l in flat)
    meta = parse_session_info(all_text)

    speeches = segment_speeches(flat)
    agenda = extract_agenda(flat)
    link_agenda(agenda, speeches)

    payload = {
        "session": {
            "number": meta["number"],
            "legislative_period": meta["legislative_period"],
            "date": meta["date"],
            "source_pdf_url": url,
            "extracted_at": datetime.datetime.utcnow().isoformat() + "Z"
        },
        "stats": {
            "pages": len(pages_lines),
            "speeches": len(speeches)
        },
        "speeches": speeches,
        "agenda_items": agenda
    }
    return payload


def main():
    args = parse_args()
    urls = gather_urls(args)
    out_dir = Path("data")
    out_dir.mkdir(exist_ok=True)

    all_results = []
    for url in urls:
        print(f"[INFO] Verarbeite {url}")
        payload = process_pdf(url, args.force_download)
        if args.schema_validate:
            try:
                validate_payload(payload)
            except Exception as e:
                print(f"[WARN] Schema-Validierung fehlgeschlagen: {e}")
        all_results.append(payload)

        filename = build_session_filename(payload)
        out_file = out_dir / filename

        # (Optional zukünftige Logik: wenn --skip-existing und out_file existiert + Hash gleich -> continue)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"[INFO] geschrieben: {out_file}")

    if len(all_results) > 1:
        index_path = out_dir / "sessions_index.json"
        index = {
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
            "sessions": [
                {
                    "legislative_period": r["session"]["legislative_period"],
                    "number": r["session"]["number"],
                    "date": r["session"]["date"],
                    "file": build_session_filename(r),
                    "speeches": r["stats"]["speeches"],
                    "pages": r["stats"]["pages"],
                    "source_pdf_url": r["session"]["source_pdf_url"]
                } for r in all_results
            ]
        }
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        print(f"[INFO] Index aktualisiert: {index_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

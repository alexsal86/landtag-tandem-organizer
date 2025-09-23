import json, datetime, sys, argparse
from pathlib import Path
from parser_core.downloader import download_pdf
from parser_core.toc import parse_toc, partition_toc
from parser_core.normalize import normalize_line, dehyphenate
from parser_core.pdftext import remove_repeated_headers_footers, flatten_pages
from parser_core.segment import segment_speeches
from parser_core.agenda import extract_agenda, link_agenda
from parser_core.metadata import parse_session_info
from parser_core.layout import extract_pages_with_layout

def run(url: str):
    pdf_path = download_pdf(url, force=False)
    pages_lines, debug_meta = extract_pages_with_layout(str(pdf_path))
    pages_lines = remove_repeated_headers_footers(pages_lines)
    norm_pages = []
    for lines in pages_lines:
        lines = [normalize_line(l) for l in lines if l.strip()]
        lines = dehyphenate(lines)
        norm_pages.append(lines)
    flat = flatten_pages(norm_pages)
    all_text = "\n".join(l["text"] for l in flat)
    meta = parse_session_info(all_text)
    toc_full = parse_toc(norm_pages[0]) if norm_pages else []
    parts = partition_toc(toc_full)
    speeches = segment_speeches(flat)
    agenda_items = extract_agenda(flat)
    link_agenda(agenda_items, speeches)
    payload = {
        "session": {
            "number": meta["number"],
            "legislative_period": meta.get("legislative_period"),
            "date": meta.get("date"),
            "source_pdf_url": url,
            "extracted_at": datetime.datetime.utcnow().isoformat()+"Z"
        },
        "layout": {"applied": True, "reason": "test-minimal"},
        "layout_debug": debug_meta,
        "toc": toc_full,
        "toc_agenda": parts["agenda"],
        "toc_speakers": parts["speakers"],
        "agenda_items": agenda_items,
        "speeches": speeches
    }
    out = Path("data/test_layout.json")
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Geschrieben:", out)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--list-file", type=str, help="Pfad zur Datei mit einer URL pro Zeile")
    parser.add_argument("url", nargs="?", help="Einzelne PDF-URL")
    args = parser.parse_args()

    if args.list_file:
        with open(args.list_file, encoding="utf-8") as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]
        for url in urls:
            run(url)
    elif args.url:
        run(args.url)
    else:
        print("Fehler: Entweder --list-file angeben oder einzelne URL übergeben.", file=sys.stderr)
        sys.exit(1)

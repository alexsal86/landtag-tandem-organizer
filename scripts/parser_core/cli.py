#!/usr/bin/env python3
import sys
import json
import argparse
from typing import Any, Dict, List

from .pipeline import parse_protocol

def main():
    p = argparse.ArgumentParser(description="Parse Landtag-Protokoll: TOC + Speeches")
    p.add_argument("input", help="Pfad zur Eingabedatei (JSON mit flat_lines)")
    p.add_argument("-o", "--output", help="Ausgabedatei (JSON). Standard: stdout")
    p.add_argument("--capture-offsets", action="store_true", help="Zeilen-Offsets in Speeches erfassen")
    p.add_argument("--debug", action="store_true", help="Debug-Infos in Speeches")
    p.add_argument("--require-bold-for-header", action="store_true", help="Header nur akzeptieren, wenn bold")
    p.add_argument("--no-abg-without-party", action="store_true", help="Abg.-Header ohne Partei nicht akzeptieren")
    p.add_argument("--no-fallback-inline-header", action="store_true", help="Keine Fallback-Erkennung im Absatz")
    p.add_argument("--include-interjection-category", action="store_true", help="Kategorie in Interjektionen beibehalten")
    p.add_argument("--externalize-interjection-offsets", action="store_true", help="Interjektions-Offsets separat ausgeben")
    args = p.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict) and "flat_lines" in data:
        flat_lines: List[Dict[str, Any]] = data["flat_lines"]
    elif isinstance(data, list):
        flat_lines = data
    else:
        print("Eingabe muss eine Liste von Zeilenobjekten oder ein Dict mit 'flat_lines' sein.", file=sys.stderr)
        sys.exit(2)

    result = parse_protocol(
        flat_lines,
        capture_offsets=args.capture_offsets,
        debug=args.debug,
        require_bold_for_header=args.require_bold_for_header,
        allow_abg_without_party=not args.no_abg_without_party,
        fallback_inline_header=not args.no_fallback_inline_header,
        compact_interjections=True,
        include_interjection_category=args.include_interjection_category,
        externalize_interjection_offsets=args.externalize_interjection_offsets
    )

    out = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
    else:
        print(out)

if __name__ == "__main__":
    main()
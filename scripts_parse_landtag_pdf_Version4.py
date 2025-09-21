#!/usr/bin/env python3
"""
Platzhalter-Parser.
Erzeugt eine Beispiel-JSON in data/.
Ersetzt das später durch echte PDF-Verarbeitung.
"""
import json, os, datetime, sys, argparse, pathlib

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-file")
    ap.add_argument("--single-url")
    ap.add_argument("--schema-validate", action="store_true")
    ap.add_argument("--log-level", default="INFO")
    args = ap.parse_args()

    os.makedirs("data", exist_ok=True)
    now = datetime.datetime.utcnow().isoformat()+"Z"
    payload = {
        "generated_at": now,
        "note": "Platzhalterdaten – noch kein echtes Parsing",
        "sources": []
    }
    if args.list_file and os.path.isfile(args.list_file):
        with open(args.list_file, "r", encoding="utf-8") as f:
            payload["sources"] = [
                line.strip() for line in f
                if line.strip() and not line.startswith("#")
            ]
    elif args.single_url:
        payload["sources"] = [args.single_url]
    else:
        payload["sources"] = ["https://example.org/dummy.pdf"]

    out_path = pathlib.Path("data/example_session.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"[INFO] wrote {out_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
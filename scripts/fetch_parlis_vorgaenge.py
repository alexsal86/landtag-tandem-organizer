#!/usr/bin/env python3
"""PARLIS Baden-Württemberg: Vorgangs-Metadaten als CSV/JSONL exportieren.

PARLIS (parlis.landtag-bw.de) hat keine dokumentierte API, aber die Weboberfläche
selbst spricht JSON. Der Ablauf, den dieses Skript nachbildet, ist der der echten
Suche:

    1. POST browse.tt.json  {"action": "SearchAndDisplay", ...}
       -> Antwort enthält search_id (+ report_id, sobald die Suche fertig ist).
          Läuft die Suche noch, wird mit {"action": "SearchAndDisplay",
          "id": <search_id>} ohne "search" nachgefragt, bis report_id kommt.
    2. GET  report.tt.html?report_id=...&start=0&chunksize=500
       -> HTML-Fragment; jeder Treffer steckt als JSON in einem HTML-Kommentar
          <!--{"EWBV02": [...], ...}-->.

Ein Report fasst serverseitig maximal 500 Treffer. Größere Zeiträume werden
deshalb automatisch proportional in Datumsscheiben geteilt (Anzahl aus der
Trefferzahl geschätzt), bis jede Scheibe darunter bleibt – so kommt auch eine
komplette Wahlperiode in einem Lauf heraus, mit möglichst wenigen Suchen.

Das ist nötig, weil PARLIS viele Suchanfragen in kurzer Zeit drosselt: danach
kommen still 0 Treffer zurück, ohne Fehlermeldung. Das Skript pausiert deshalb
standardmäßig 2 s; bei großen Läufen lieber 5–10 s (`--pause 8`) und den Lauf
auf mehrere Zeitfenster verteilen. Wenn plötzlich eine Scheibe 0 Treffer hat,
die vorher Treffer hatte: einige Minuten warten und dieselbe Scheibe mit
`--append` erneut laufen lassen (bereits geschriebene Zeilen werden übersprungen).

Die Feldcodes (EWB*) sind die internen Feldkennungen der Parlamentsdokumentation;
die wichtigsten sind in FIELD_MAP unten benannt.

Wichtig:
  * Die PDFs selbst liegen auf www.landtag-bw.de hinter einer Enodia-Prüfung
    (Proof-of-Work-Cookie) und werden hier bewusst NICHT abgerufen. Dieses Skript
    holt nur Metadaten samt PDF-URL.
  * Höflich bleiben: kein Parallelismus, Standardpause 2 s zwischen Anfragen.

Beispiele:
    # komplette Wahlperiode 17 als CSV (Excel-freundlich: Semikolon + BOM)
    python3 scripts/fetch_parlis_vorgaenge.py --wahlperiode 17 --out exports/wp17.csv

    # Wahlperiode 18, nur ein Zeitfenster
    python3 scripts/fetch_parlis_vorgaenge.py --wahlperiode 18 \
        --von 01.11.2026 --bis 26.11.2026 --out exports/wp18-nov.csv

    # zweites Zeitfenster an dieselbe Datei anhängen (idempotent)
    python3 scripts/fetch_parlis_vorgaenge.py --wahlperiode 18 \
        --von 01.12.2026 --bis 31.12.2026 --out exports/wp18-nov.csv --append
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

BASE = "https://parlis.landtag-bw.de/parlis/"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
REPORT_SPEC = {
    "format": "suchergebnis-vorgang",
    "mime": "html",
    "sort": "SORT01/D SORT02/D SORT03",
}
PAGE_SIZE = 500  # Obergrenze je Report serverseitig
SLICE_TARGET = 450  # angepeilte Treffer je Datumsscheibe (Sicherheitsabstand zu 500)

# Beginn der Wahlperioden (aus den PARLIS-Daten abgeleitet). Ohne --von wird ab
# hier gesucht, damit "--wahlperiode 17" allein den richtigen Zeitraum trifft.
#
# WP 9 ist die älteste Wahlperiode, die PARLIS führt; WP 8 und älter liefern auch
# ohne Datumsfilter 0 Treffer (geprüft am 27.11.2026, gegengeprüft mit WP 9 =
# 6.158 Treffern im selben Zeitfenster, also keine Drosselung). Ältester Vorgang:
# 01.06.1984. Deshalb gibt es hier bewusst keinen Eintrag für WP 8.
WP_START = {
    9: "01.05.1984",
    10: "01.05.1988",
    11: "01.05.1992",
    12: "01.05.1996",
    13: "01.05.2001",
    14: "01.05.2006",
    15: "01.05.2011",
    16: "01.05.2016",
    17: "01.05.2021",
    18: "30.04.2026",
}
RECORD_RE = re.compile(r"<!--(\{.*?\})-->", re.S)
DATE_RE = re.compile(r"\b(\d{2})\.(\d{2})\.(\d{4})\b")

# Suchzeilen der Suchmaske "Vorgänge" (Reihenfolge aus esearch.tt.cfg,
# SearchMap searchmap-vorgang): l1 Wahlperiode, l2 von, l3 bis,
# l4 Vorgangstyp, l5 Urheber, l6 Deskriptor, l7 Suchbegriff.
FIELD_MAP = {
    "EWBV01": "dokumentnummer_intern",  # z. B. 18D0052100
    "EWBV02": "vorgangs_id",            # z. B. V-248976
    "EWBV10": "titel",
    "EWBV22": "drucksache",             # z. B. "Drucksache 18/866 (4 S.)"
    "EWBV23": "vorgang_text",           # Typ + Urheber + Datum + Ressort
    "EWBV30": "pdf_url",
    "EWBV31": "pdf_bytes",
    "EWBV32": "pdf_mime",
    "EWBV34": "deskriptoren",
    "EWBD01": "dokument_text",          # Drucksache + Datum + Seiten
    "EWBD05": "dokument_url",
    "EWBD06": "dokument_bytes",
    "EWBD07": "dokument_mime",
}

# Vorgangstypen, die in EWBV23 dem Urheber vorangestellt sind. Längste zuerst,
# damit "Kleine Anfrage" nicht zu "Kleine" verkürzt wird.
VORGANGSTYPEN = (
    "Geschäftsordnungsantrag",
    "Entschließungsantrag",
    "Dringlicher Antrag",
    "Änderungsantrag",
    "Aktuelle Stunde",
    "Vereidigung",
    "Aussprache",
    "Befragung",
    "Ansprache",
    "Gesetzentwurf",
    "Erste Ausgabe Verzeichnis",
    "Erklärung",
    "Debatte",
    "Regierungsbefragung",
    "Beschlussempfehlung",
    "Gesetzesbeschluss",
    "Aktuelle Debatte",
    "Mündliche Anfrage",
    "Kleine Anfrage",
    "Große Anfrage",
    "Dringliche Anfrage",
    "Gesetzgebung",
    "Volksantrag",
    "Mitteilung",
    "Vorschlag",
    "Unterrichtung",
    "Erlass",
    "Bericht",
    "Antrag",
    "Wahl",
)

CSV_COLUMNS = [
    "vorgangs_id",
    "dokumentnummer_intern",
    "drucksache",
    "vorgangstyp",
    "datum",
    "urheber",
    "ressort",
    "titel",
    "deskriptoren",
    "pdf_url",
    "dokument_url",
    "vorgang_text",
    "id",
]


def parse_de(value: str) -> date:
    return datetime.strptime(value, "%d.%m.%Y").date()


def format_de(value: date) -> str:
    return value.strftime("%d.%m.%Y")


def _request(url: str, payload: dict | None = None, timeout: int = 120) -> str:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": BASE + "?action=searchMeldungModal",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def _json(url: str, payload: dict) -> dict:
    body = _request(url, payload)
    match = re.search(r"\{.*\}", body, re.S)
    if not match:
        raise RuntimeError(f"Keine JSON-Antwort von {url}: {body[:200]!r}")
    return json.loads(match.group(0))


def search_lines(args: argparse.Namespace) -> dict[str, str]:
    lines: dict[str, str] = {}
    if args.wahlperiode:
        lines["l1"] = str(args.wahlperiode)
    if args.vorgangstyp:
        lines["l4"] = args.vorgangstyp
    if args.urheber:
        lines["l5"] = args.urheber
    if args.begriff:
        lines["l7"] = args.begriff
    return lines


def start_search(lines: dict[str, str], pause: float) -> tuple[str, str, int]:
    """Suche starten. Liefert (search_id, report_id, Trefferzahl)."""
    payload = {
        "action": "SearchAndDisplay",
        "sources": ["Star"],
        "report": dict(REPORT_SPEC),
        "search": {"lines": lines, "serverrecordname": "vorgang"},
    }
    answer = _json(BASE + "browse.tt.json", payload)
    reported = int((answer.get("sources") or {}).get("Star", {}).get("hits") or 0)
    search_id = answer.get("search_id") or ""

    # Leere Scheibe: der Server liefert keine report_id, dann nicht weiter pollen.
    if reported == 0 and not answer.get("report_id"):
        return search_id, "", 0

    poll = 0
    while not answer.get("report_id"):
        if not search_id:
            raise RuntimeError(f"Suche ohne search_id: {answer}")
        poll += 1
        if poll > 10:
            raise RuntimeError("Suche wurde nach 10 Polls nicht fertig")
        time.sleep(pause)
        answer = _json(
            BASE + "browse.tt.json",
            {
                "action": "SearchAndDisplay",
                "sources": ["Star"],
                "report": dict(REPORT_SPEC),
                "id": search_id,
            },
        )
        reported = max(reported, int((answer.get("sources") or {}).get("Star", {}).get("hits") or 0))
        if reported == 0:
            return search_id, "", 0

    return search_id, answer["report_id"], reported


def fetch_page(report_id: str, pause: float) -> list[dict]:
    """Die Datensätze eines Reports (max. 500) aus dem HTML-Fragment lesen."""
    time.sleep(pause)
    url = f"{BASE}report.tt.html?report_id={report_id}&start=0&chunksize={PAGE_SIZE}"
    html = _request(url)
    return [json.loads(blob) for blob in RECORD_RE.findall(html)]


def collect(lines: dict[str, str], pause: float, depth: int = 0) -> list[dict]:
    """Zeitraum abfragen; bei mehr als SLICE_TARGET Treffern proportional
    in gleich große Datumsstücke teilen (ein Report fasst nur 500 Treffer)."""
    von = parse_de(lines["l2"])
    bis = parse_de(lines["l3"])
    print(f"  Scheibe {lines['l2']} – {lines['l3']} …", file=sys.stderr, end=" ", flush=True)
    _, report_id, hits = start_search(lines, pause)
    print(f"{hits} Treffer", file=sys.stderr)

    if hits == 0:
        return []

    if hits > SLICE_TARGET and depth < 6:
        parts = min(12, math.ceil(hits / SLICE_TARGET))
        span = (bis - von).days + 1
        records: list[dict] = []
        for index in range(parts):
            part_von = von + timedelta(days=span * index // parts)
            part_bis = von + timedelta(days=span * (index + 1) // parts - 1)
            sub = dict(lines, l2=format_de(part_von), l3=format_de(part_bis))
            records.extend(collect(sub, pause, depth + 1))
        return records

    return fetch_page(report_id, pause)


def _split_vorgang_text(text: str) -> tuple[str | None, str | None, str | None, str | None]:
    """EWBV23 (z. B. "Kleine Anfrage X (SPD)  25.11.2026 und Antwort Ministerium")
    in Typ, Urheber, Datum und Ressort zerlegen."""
    if not text:
        return None, None, None, None

    typ = next((name for name in VORGANGSTYPEN if text.startswith(name)), None)
    rest = text[len(typ):].strip() if typ else text.strip()

    match = DATE_RE.search(rest)
    if not match:
        return typ, rest or None, None, None

    urheber = re.sub(r"\s{2,}", " ", rest[: match.start()]).strip(" ,;")
    datum = f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
    tail = rest[match.end():].strip(" ,;")
    ressort = re.sub(
        r"^(und\s+)?(Antwort|Stellungnahme|Bericht|Mitteilung)\s+",
        "",
        tail,
        flags=re.IGNORECASE,
    ).strip(" ,;")
    return typ or None, urheber or None, datum, ressort or None


def flatten(record: dict) -> dict:
    """PARLIS-Feldcodes in lesbare Namen und eine flache Zeile übersetzen."""
    out: dict = {"id": record.get("_id")}
    for code, name in FIELD_MAP.items():
        value = record.get(code)
        if not value:
            continue
        if name == "deskriptoren":
            out[name] = [entry.get("main") for entry in value if entry.get("main")]
        else:
            out[name] = value[0].get("main")

    text = out.get("vorgang_text") or ""
    typ, urheber, datum, ressort = _split_vorgang_text(text)
    if typ is None and str(out.get("drucksache") or "").startswith("Plenarprotokoll"):
        # Redebeiträge aus Plenarprotokollen tragen in EWBV23 oft keinen Typ.
        typ = "Redebeitrag"
    out.update(vorgangstyp=typ, urheber=urheber, datum=datum, ressort=ressort)
    if isinstance(out.get("deskriptoren"), list):
        out["deskriptoren"] = "; ".join(out["deskriptoren"])
    return out


def row_key(row: dict) -> tuple[str, str]:
    """Fachlicher Schlüssel einer Zeile: Vorgang + Dokument."""
    return (
        str(row.get("vorgangs_id") or ""),
        str(row.get("dokumentnummer_intern") or row.get("id") or ""),
    )


def existing_keys(target: str, fmt: str) -> set[tuple[str, str]]:
    """Bereits geschriebene Zeilen lesen, damit --append idempotent bleibt."""
    path = Path(target)
    if not path.exists() or path.stat().st_size == 0:
        return set()
    keys: set[tuple[str, str]] = set()
    with path.open(encoding="utf-8-sig" if fmt == "csv" else "utf-8", newline="") as stream:
        if fmt == "csv":
            for row in csv.DictReader(stream, delimiter=";"):
                keys.add(row_key(row))
        else:
            for line in stream:
                if line.strip():
                    keys.add(row_key(json.loads(line)))
    return keys


def write_output(rows: list[dict], target: str, fmt: str, append: bool = False) -> None:
    path = None if target == "-" else Path(target)
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Beim Anhängen keine zweite BOM und keinen zweiten Kopf schreiben.
        existing = append and path.exists() and path.stat().st_size > 0
        encoding = "utf-8" if existing or fmt != "csv" else "utf-8-sig"
        stream = path.open("a" if existing else "w", encoding=encoding, newline="")
    else:
        existing = False
        stream = sys.stdout

    try:
        if fmt == "csv":
            writer = csv.DictWriter(
                stream, fieldnames=CSV_COLUMNS, delimiter=";", extrasaction="ignore"
            )
            if not existing:
                writer.writeheader()
            for row in rows:
                writer.writerow(row)
        else:
            for row in rows:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    finally:
        if stream is not sys.stdout:
            stream.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PARLIS BW: Vorgangs-Metadaten als CSV/JSONL exportieren",
    )
    parser.add_argument("--wahlperiode", type=int, default=18, help="Standard: 18")
    parser.add_argument("--von", help="TT.MM.JJJJ (Standard: --seit)")
    parser.add_argument("--bis", help="TT.MM.JJJJ (Standard: heute)")
    parser.add_argument(
        "--seit",
        default="01.01.2026",
        help="Startdatum, falls --von fehlt und die Wahlperiode unbekannt ist",
    )
    parser.add_argument("--vorgangstyp", help="z. B. Kleine Anfrage")
    parser.add_argument("--urheber", help="z. B. GRÜNE")
    parser.add_argument("--begriff", help="Suchbegriff in den Titelfeldern")
    parser.add_argument("--out", default="-", help="Zieldatei (.csv/.jsonl) oder - für stdout")
    parser.add_argument(
        "--format",
        choices=("auto", "csv", "jsonl"),
        default="auto",
        help="auto = aus der Dateiendung ableiten",
    )
    parser.add_argument("--pause", type=float, default=2.0, help="Pause in Sekunden")
    parser.add_argument(
        "--append",
        action="store_true",
        help="an bestehende Datei anhängen (idempotent, für mehrere Zeitfenster)",
    )
    args = parser.parse_args()

    fmt = args.format
    if fmt == "auto":
        fmt = "csv" if args.out.lower().endswith(".csv") else "jsonl"

    start = args.von or WP_START.get(args.wahlperiode, args.seit)
    von = parse_de(start)
    bis = parse_de(args.bis) if args.bis else date.today()
    if von > bis:
        parser.error("--von liegt nach --bis")

    lines = search_lines(args)
    lines["l2"] = format_de(von)
    lines["l3"] = format_de(bis)
    print(
        f"PARLIS-Export: Wahlperiode {args.wahlperiode}, {format_de(von)} – "
        f"{format_de(bis)}, Format {fmt}",
        file=sys.stderr,
    )

    records = collect(lines, args.pause)
    if not records:
        print(
            "WARNUNG: keine Treffer – entweder leerer Zeitraum oder PARLIS drosselt "
            "gerade (dann hilft eine Pause von einigen Minuten).",
            file=sys.stderr,
        )

    rows: list[dict] = []
    # Beim Anhängen zählen bereits geschriebene Zeilen mit, damit ein erneuter
    # Lauf desselben Zeitfensters nichts doppelt.
    seen: set[tuple[str, str]] = existing_keys(args.out, fmt) if args.append else set()
    already = len(seen)
    for record in records:
        row = flatten(record)
        key = row_key(row)
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)

    rows.sort(key=lambda row: (row.get("datum") or "", row.get("vorgangs_id") or ""))
    write_output(rows, args.out, fmt, append=args.append)

    print(
        f"Fertig: {len(rows)} Zeilen neu ({len(records) - len(rows)} Duplikate verworfen, "
        f"{already} bereits in der Datei)",
        file=sys.stderr,
    )
    if args.out != "-":
        print(f"Datei: {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (urllib.error.URLError, RuntimeError) as error:
        print(f"Fehler: {error}", file=sys.stderr)
        raise SystemExit(1)

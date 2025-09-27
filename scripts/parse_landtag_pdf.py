#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_landtag_pdf.py (verbessert v1.2)

Verbesserungen:
- Force two-column für TOC-Seiten, separate Verarbeitung links/rechts.
- Bessere TOC: Extrahiere Seitenzahlen, merge Sprecher korrekt.
- Speech: Angepasste Regex, end_page hinzugefügt.
- Debugging für Matches.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber
import requests

# ------------------------- Downloader -------------------------

def download_pdf(url_or_path: str, cache_dir: str = ".cache/pdfs", force: bool = False) -> Path:
    try:
        p = Path(url_or_path)
        if p.exists():
            return p
        Path(cache_dir).mkdir(parents=True, exist_ok=True)
        h = hashlib.sha256(url_or_path.encode("utf-8")).hexdigest()[:16]
        out = Path(cache_dir) / f"{h}.pdf"
        if out.exists() and not force:
            return out
        r = requests.get(url_or_path, timeout=60)
        r.raise_for_status()
        out.write_bytes(r.content)
        return out
    except Exception as e:
        raise ValueError(f"Fehler beim Download: {e}")

# ------------------------- Layout extraction -------------------------

@dataclass
class PageMeta:
    page: int
    method: str
    split_x: float
    columns: int
    left_fraction: float
    right_fraction: float
    words: int
    page_width: float

DOT_LEADERS = re.compile(r"\.{2,}")
ELLIPSIS = "…"

def _histogram_split_x(word_centers: List[float], page_width: float, bins: int = 70) -> Optional[float]:
    if not word_centers or page_width <= 0:
        return None
    lo = min(word_centers)
    hi = max(word_centers)
    if hi - lo < page_width * 0.30:
        return None
    bin_w = (hi - lo) / bins if bins > 0 else (hi - lo)
    counts = []
    edges = []
    for i in range(bins):
        start = lo + i * bin_w
        end = start + bin_w
        edges.append((start, end))
        cnt = sum(1 for c in word_centers if start <= c < end)
        counts.append(cnt)
    # grob zwei Peaks suchen
    peaks = []
    for i in range(1, bins - 1):
        if counts[i] > counts[i - 1] and counts[i] > counts[i + 1]:
            peaks.append((counts[i], i))
    if len(peaks) < 2:
        return None
    peaks.sort(reverse=True)
    (c1, i1), (c2, i2) = sorted(peaks[:2], key=lambda x: x[1])
    # tal finden
    valley = None
    valley_i = None
    for j in range(i1 + 1, i2):
        v = counts[j]
        if valley is None or v < valley:
            valley = v; valley_i = j
    if valley is None:
        return None
    return (edges[valley_i][0] + edges[valley_i][1]) / 2.0

def _group_lines_by_y(words: List[dict], y_quant: float = 3.0) -> List[List[dict]]:
    buckets: Dict[int, List[dict]] = {}
    for w in words:
        yk = int(round(w["top"] / y_quant))
        buckets.setdefault(yk, []).append(w)
    lines = []
    for yk in sorted(buckets.keys()):
        line = sorted(buckets[yk], key=lambda w: w["x0"])
        lines.append(line)
    return lines

def _words_to_lines_text(words: List[dict]) -> List[str]:
    lines = _group_lines_by_y(words)
    out = []
    for line in lines:
        out.append(" ".join(w["text"] for w in line))
    return out

def detect_columns(words: List[dict], page_width: float, force_two: bool = False) -> int:
    if force_two:
        return 2
    mids = [(w["x0"] + w["x1"]) / 2.0 for w in words]
    split_x = _histogram_split_x(mids, page_width)
    if split_x is None:
        return 1
    left_count = sum(1 for m in mids if m < split_x)
    right_count = len(mids) - left_count
    if min(left_count, right_count) / len(mids) < 0.4:  # Erhöht von 0.3
        return 1
    return 2

def extract_lines(pdf_path: Path) -> Tuple[List[List[str]], List[PageMeta]]:
    pages_text: List[List[str]] = []
    metas: List[PageMeta] = []
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                pw = float(page.width or 0.0)
                words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
                if not words:
                    pages_text.append([])
                    metas.append(PageMeta(page.page_number, "empty", 0.0, 1, 0.0, 0.0, 0, pw))
                    continue
                force_two = page.page_number <= 3  # Force für TOC-Seiten
                mids = [(w["x0"] + w["x1"]) / 2.0 for w in words]
                columns = detect_columns(words, pw, force_two)
                if columns == 1:
                    split_x = 0.0
                    left_words = words
                    right_words = []
                    left_frac = 1.0
                    right_frac = 0.0
                    method = "one-column"
                else:
                    split_x = _histogram_split_x(mids, pw) or (pw * 0.5)
                    left_words = [w for w in words if ((w["x0"] + w["x1"]) / 2.0) < split_x]
                    right_words = [w for w in words if ((w["x0"] + w["x1"]) / 2.0) >= split_x]
                    total = max(1, len(words))
                    left_frac = len(left_words) / total
                    right_frac = len(right_words) / total
                    method = "two-column"
                # Zeilen: erst links top→bottom, dann rechts
                left_lines = _words_to_lines_text(left_words)
                right_lines = _words_to_lines_text(right_words)
                lines = [l for l in left_lines + right_lines if l.strip()]
                pages_text.append(lines)
                metas.append(PageMeta(
                    page=page.page_number,
                    method=method,
                    split_x=round(split_x, 2),
                    columns=columns,
                    left_fraction=round(left_frac, 3),
                    right_fraction=round(right_frac, 3),
                    words=len(words),
                    page_width=round(pw, 2)
                ))
        # Normalize lines (collapse spaces, remove footers)
        norm_pages = []
        for lines in pages_text:
            norm = []
            for l in lines:
                l = l.replace(ELLIPSIS, ".")
                l = DOT_LEADERS.sub(" ", l)
                l = re.sub(r"Landtag von Baden-Württemberg.*", "", l)  # Footer
                l = re.sub(r"\s+", " ", l).strip()
                if l:
                    norm.append(l)
            norm_pages.append(norm)
        return norm_pages, metas
    except Exception as e:
        raise ValueError(f"Fehler beim PDF-Parsing: {e}")

# ------------------------- TOC parsing -------------------------

TOC_HEADER_RX = re.compile(r"^\s*(I\s*N\s*H\s*A\s*L\s*T|INHALT)\s*$", re.IGNORECASE)
PAGE_ONLY_RX = re.compile(r"^\s*\d{3,5}\s*$")
AGENDA_NUM_RX = re.compile(r"^\s*(\d+)\.\s+(.*)$")
AGENDA_KEYWORDS_RX = re.compile(r"\b(Beschluss|Beschlussempfehlung|Zweite Beratung|Aktuelle Debatte|Erste Beratung|Dritte Beratung|Antrag)\b", re.IGNORECASE)
DRS_RX = re.compile(r"(?:Drucksache|Drs\.)\s*(\d+/\d+)", re.IGNORECASE)
PAGE_RX = re.compile(r"(\d{4})(?:,\s*\d{4})*$")  # Für Seitenzahlen wie 7639 oder 7639, 7650

SPEAKER_RX = re.compile(
    r"^\s*(Abg\.|Präsidentin|Präsident|Vizepräsidentin|Vizepräsident|Minister(?:in)?|Staatssekretär(?:in)?)\s+(.{1,120}?)(?:\s+(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN))?\s*$",
    re.IGNORECASE
)

def strip_trailing_pages_and_dots(s: str) -> Tuple[str, Optional[str]]:
    s = DOT_LEADERS.sub(" ", s.replace(ELLIPSIS, " "))
    m = PAGE_RX.search(s)
    page_str = m.group(1) if m else None
    s = re.sub(r"\s+\d{3,5}(?:\s*,\s*\d{3,5})*\s*$", "", s)
    s = re.sub(r"[ .–-]+$", "", s)
    return re.sub(r"\s{2,}", " ", s).strip(), page_str

def assemble_toc_from_pages(pages: List[List[str]], look_pages: int = 3) -> List[Dict[str, Any]]:
    if not pages:
        return []
    first_pages = []
    for lines in pages[:look_pages]:
        first_pages.extend(lines)
    start = 0
    for i, l in enumerate(first_pages):
        if TOC_HEADER_RX.match(l):
            start = i + 1
            break
    lines = first_pages[start:]
    items: List[Dict[str, Any]] = []
    cur: Optional[Dict[str, Any]] = None
    cur_title_lines: List[str] = []
    cur_speakers: List[str] = []

    def finalize():
        nonlocal cur, items, cur_title_lines, cur_speakers
        if cur:
            title = " ".join(cur_title_lines).strip()
            if title.endswith('-'):
                title = title[:-1]
            title, start_page = strip_trailing_pages_and_dots(title)
            cur["title"] = title
            cur["start_page"] = start_page
            cur["speakers"] = [strip_trailing_pages_and_dots(s)[0] for s in cur_speakers if s]
            drs = DRS_RX.findall(cur["title"])
            if drs:
                cur["docket"] = drs[-1]
            items.append(cur)
            cur = None
            cur_title_lines = []
            cur_speakers = []

    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        if not ln or PAGE_ONLY_RX.match(ln):
            i += 1
            continue
        mnum = AGENDA_NUM_RX.match(ln)
        is_keyword = bool(AGENDA_KEYWORDS_RX.search(ln))
        is_speaker = bool(SPEAKER_RX.match(ln))
        looks_new = bool(mnum) or is_keyword or ("Drucksache" in ln)
        if looks_new:
            finalize()
            if mnum:
                num = int(mnum.group(1))
                rest = mnum.group(2)
                cur = {"number": num, "title": "", "docket": None, "speakers": [], "start_page": None}
                cur_title_lines = [rest]
            else:
                cur = {"number": None, "title": "", "docket": None, "speakers": [], "start_page": None}
                cur_title_lines = [ln]
            i += 1
            continue
        if cur:
            if is_speaker:
                cur_speakers.append(ln)
            else:
                joiner = "" if cur_title_lines[-1].endswith("-") else " "
                cur_title_lines[-1] = (cur_title_lines[-1].rstrip("-") + joiner + ln).strip()
        i += 1
    finalize()
    # Dedup und merge
    dedup = []
    seen = set()
    for it in items:
        key = (it.get("number"), it["title"].lower())
        if key in seen:
            if dedup:
                last = dedup[-1]
                last["speakers"].extend([s for s in it["speakers"] if s not in last["speakers"]])
            continue
        seen.add(key)
        dedup.append(it)
    return dedup

# ------------------------- Speeches (Body) -------------------------

ROLE_TOKENS = [
    r"Abg\.", r"Präsidentin", r"Präsident", r"Vizepräsidentin", r"Vizepräsident",
    r"Minister(?:in)?", r"Staatssekretär(?:in)?"
]
PARTY_TOKENS = r"(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)"
HEADER_RX = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+(?P<name>[^:\n]{{1,160}}?)(?:\s+(?P<party>{PARTY_TOKENS}))?\s*(?::|\.)?\s*$",
    re.IGNORECASE
)

def normalize_speaker(name: str) -> str:
    return " ".join(word.capitalize() for word in name.strip().split())

def find_first_body_header(lines: List[str]) -> int:
    for i, l in enumerate(lines):
        if HEADER_RX.match(l):
            return i
    return 0

def segment_speeches_from_pages(pages: List[List[str]]) -> List[Dict[str, Any]]:
    flat: List[Tuple[int, str]] = []
    for p_idx, lines in enumerate(pages, start=1):
        for l in lines:
            if l.strip():
                flat.append((p_idx, l))
    start_idx = find_first_body_header([t for _, t in flat])
    body = flat[start_idx:]
    speeches: List[Dict[str, Any]] = []
    cur: Optional[Dict[str, Any]] = None
    buf: List[str] = []
    prev_page = 1
    def flush():
        nonlocal cur, buf, prev_page
        if cur:
            text = "\n".join(buf).strip()
            text = re.sub(r"\n{3,}", "\n\n", text)
            cur["text"] = text
            cur["end_page"] = prev_page
            speeches.append(cur)
            cur = None
            buf = []
    for p, line in body:
        prev_page = p
        m = HEADER_RX.match(line)
        if m:
            flush()
            role = m.group("role")
            name = normalize_speaker(m.group("name"))
            party = m.group("party")
            cur = {
                "index": len(speeches),
                "start_page": p,
                "end_page": None,
                "speaker": f"{name}",
                "role": role,
                "party": (party or "").replace("GRUENE", "GRÜNE") if party else None,
                "text": ""
            }
        else:
            if cur:
                line_clean = re.sub(r"\([^()]*?(Beifall|Zuruf|Heiterkeit|Lachen|Unruhe|Zwischenruf|Widerspruch|Glocke|Zurufe)[^()]*?\)", " ", line, flags=re.IGNORECASE | re.DOTALL)
                line_clean = re.sub(r"\s+", " ", line_clean).strip()
                buf.append(line_clean)
    flush()
    for i, sp in enumerate(speeches):
        sp["index"] = i
    return speeches

# ------------------------- Metadata helpers -------------------------

def parse_session_info(all_text: str) -> Dict[str, Any]:
    number = None
    m1 = re.search(r"(\d{1,3})\.\s*Sitzung", all_text)
    if m1: number = int(m1.group(1))
    leg = None
    m2 = re.search(r"(\d{1,2})\.\s*Wahlperiode", all_text)
    if m2: leg = int(m2.group(1))
    date = None
    m3 = re.search(r"(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})", all_text)
    MONTHS = {
        "januar":1,"februar":2,"märz":3,"maerz":3,"april":4,"mai":5,"juni":6,"juli":7,"august":8,"september":9,"oktober":10,"november":11,"dezember":12
    }
    if m3:
        day = int(m3.group(1)); mon = m3.group(2).lower().replace("ä","ae").replace("ö","oe").replace("ü","ue").replace("ß","ss")
        year = int(m3.group(3)); mm = MONTHS.get(mon)
        if mm: date = f"{year:04d}-{mm:02d}-{day:02d}"
    start_time_match = re.search(r"Beginn:\s*(\d{1,2}:\d{2})\s*Uhr", all_text)
    start_time = start_time_match.group(1) if start_time_match else None
    end_time_match = re.search(r"Schluss:\s*(\d{1,2}:\d{2})\s*Uhr", all_text)
    end_time = end_time_match.group(1) if end_time_match else None
    return {
        "number": number,
        "legislative_period": leg,
        "date": date,
        "start_time": start_time,
        "end_time": end_time
    }

# ------------------------- Main pipeline -------------------------

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

def process_pdf(url: str, force_download: bool) -> Dict[str, Any]:
    pdf_path = download_pdf(url, force=force_download)
    pages, metas = extract_lines(pdf_path)
    all_text = "\n".join("\n".join(p) for p in pages)
    meta = parse_session_info(all_text)
    meta["source_pdf_url"] = url
    meta["extracted_at"] = dt.datetime.utcnow().isoformat() + "Z"
    toc_agenda = assemble_toc_from_pages(pages, look_pages=3)
    speeches = segment_speeches_from_pages(pages)
    agenda_items = []
    for item in toc_agenda:
        agenda_items.append({
            "code": f"Punkt {item['number']}" if item['number'] else None,
            "title": item['title'],
            "docket": item['docket'],
            "speakers": item['speakers'],
            "start_page": item['start_page']
        })
    payload: Dict[str, Any] = {
        "session": {
            "number": meta.get("number"),
            "legislative_period": meta.get("legislative_period"),
            "date": meta.get("date"),
            "source_pdf_url": url,
            "extracted_at": meta.get("extracted_at")
        },
        "sitting": {
            "start_time": meta.get("start_time"),
            "end_time": meta.get("end_time"),
            "location": None
        },
        "stats": {
            "pages": len(pages),
            "speeches": len(speeches)
        },
        "layout": {
            "applied": True,
            "reason": "two-column-by-words"
        },
        "toc_agenda": toc_agenda,
        "agenda_items": agenda_items,
        "speeches": speeches
    }
    payload["_layout_debug_internal"] = {
        "layout_metadata": [m.__dict__ for m in metas],
        "normalized_pages": pages
    }
    return payload

# ------------------------- IO -------------------------

def write_outputs(payload: Dict[str, Any], out_dir: Path) -> Tuple[Path, Optional[Path]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    base = build_session_filename(payload)
    session_path = out_dir / base
    layout_file = base.replace(".json", ".layout.json")
    sidecar = payload.pop("_layout_debug_internal", None)
    payload["schema_version"] = "1.2-fixed-toc"
    with session_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    sidecar_path = None
    if sidecar is not None:
        sidecar_path = session_path.parent / layout_file
        with sidecar_path.open("w", encoding="utf-8") as f:
            json.dump({
                "session_ref": session_path.name,
                "schema_version": "1.2-layout-debug",
                "layout_debug": sidecar
            }, f, ensure_ascii=False, indent=2)
    return session_path, sidecar_path

# ------------------------- CLI -------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Verbesserter Parser: TOC + Speeches.")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--single-url", help="PDF-URL oder lokaler Pfad")
    g.add_argument("--list-file", help="Datei mit Zeilenweise URLs")
    p.add_argument("--force-download", action="store_true")
    return p.parse_args()

def gather_urls(args) -> List[str]:
    if args.single_url:
        return [args.single_url.strip()]
    urls: List[str] = []
    for line in Path(args.list_file).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            urls.append(line)
    if not urls:
        raise SystemExit("Keine URLs gefunden.")
    return urls

def main() -> int:
    args = parse_args()
    urls = gather_urls(args)
    out_dir = Path("data")
    for url in urls:
        print(f"[INFO] Verarbeite {url}")
        try:
            payload = process_pdf(url, force_download=args.force_download)
            sp, lp = write_outputs(payload, out_dir)
            print(f"[INFO] geschrieben: {sp.name} {'+' if lp else ''} {lp.name if lp else ''}")
        except ValueError as e:
            print(f"[ERROR] Bei {url}: {e}")
    return 0

if __name__ == "__main__":
    sys.exit(main())

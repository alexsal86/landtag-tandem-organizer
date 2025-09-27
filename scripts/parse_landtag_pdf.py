#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_landtag_pdf.py (robuster TOC-Parser integriert, v2.0.0)

Änderungen in dieser Version:
- Robustes Inhaltsverzeichnis direkt in dieser Datei implementiert (keine Imports anderer Scripts).
  - TOC/Body-Trennung: looks_like_inhalt_heading + is_body_start_line + split_toc_and_body
  - TOC-Parsing: parse_toc(flat_lines) erzeugt strukturierte Items mit Nummer, Titel, Subentries, Rednern, Drs.
- Spalten-Trenner: Bei zweispaltigen Seiten wird zwischen linker und rechter Spalte eine leere Zeile eingefügt,
  damit das TOC-Parsing keine Zeilen über den Spaltenumbruch hinweg zusammenführt.
- Leere Zeilen werden erhalten (keine Vorab-Filterung).
- Bestehende Rede-Segmentierung beibehalten.
- Ergebnis-JSON: neues Feld "toc" (statt "toc_agenda"). Legacy-Funktion assemble_toc_from_pages bleibt als Referenz enthalten, wird aber nicht mehr genutzt.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path

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
    (_c1, i1), (_c2, i2) = sorted(peaks[:2], key=lambda x: x[1])
    # tal finden
    valley = None
    valley_i = None
    for j in range(i1 + 1, i2):
        v = counts[j]
        if valley is None or v < valley:
            valley = v
            valley_i = j
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

def detect_columns(words: List[dict], page_width: float) -> int:
    mids = [(w["x0"] + w["x1"]) / 2.0 for w in words]
    split_x = _histogram_split_x(mids, page_width)
    if split_x is None:
        return 1
    left_count = sum(1 for m in mids if m < split_x)
    right_count = len(mids) - left_count
    if min(left_count, right_count) / len(mids) < 0.3:
        return 1
    return 2

def extract_lines(pdf_path: Path) -> Tuple[List[List[str]], List[PageMeta]]:
    pages_text: List[List[str]] = []
    metas: List[PageMeta] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            pw = float(page.width or 0.0)
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
            if not words:
                pages_text.append([])
                metas.append(PageMeta(page.page_number, "empty", 0.0, 1, 0.0, 0.0, 0, pw))
                continue

            columns = detect_columns(words, pw)
            mids = [(w["x0"] + w["x1"]) / 2.0 for w in words]
            split_x = _histogram_split_x(mids, pw) or (pw * 0.5)

            if columns == 1:
                lines = _words_to_lines_text(words)
                left_frac = 1.0
                right_frac = 0.0
                method = "single-column"
                split_val = 0.0
            else:
                left_words = [w for w in words if ((w["x0"] + w["x1"]) / 2.0) < split_x]
                right_words = [w for w in words if ((w["x0"] + w["x1"]) / 2.0) >= split_x]
                total = max(1, len(words))
                left_frac = len(left_words) / total
                right_frac = len(right_words) / total
                left_lines = _words_to_lines_text(left_words)
                right_lines = _words_to_lines_text(right_words)
                # WICHTIG: Spalten-Trenner einfügen, damit TOC nicht über Spalten hinweg merged
                lines = left_lines + [""] + right_lines
                method = "two-column"
                split_val = round(split_x, 2)

            pages_text.append(lines)
            metas.append(PageMeta(
                page=page.page_number,
                method=method,
                split_x=split_val,
                columns=columns,
                left_fraction=round(left_frac, 3),
                right_fraction=round(right_frac, 3),
                words=len(words),
                page_width=round(pw, 2)
            ))

    # Normalize lines (Punkte, Ellipsen, Whitespace), leere Zeilen erhalten
    norm_pages: List[List[str]] = []
    for lines in pages_text:
        norm: List[str] = []
        for l in lines:
            l = l.replace(ELLIPSIS, ".")
            l = DOT_LEADERS.sub(" ", l)
            l = re.sub(r"\s+", " ", l).strip()
            norm.append(l)  # leere Zeilen bleiben leere Strings
        norm_pages.append(norm)
    return norm_pages, metas

# ------------------------- Robust TOC splitter & parser (inline) -------------------------

def _nfkc(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "")

# Header-Erkennung (Body-Start)
ROLE_TOKENS = [
    r"Abg\.", r"Präsidentin", r"Präsident", r"Vizepräsidentin", r"Vizepräsident",
    r"Ministerpräsident(?:in)?", r"Minister(?:in)?", r"Staatssekretär(?:in)?"
]
PARTY_TOKENS = r"(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)"
HEADER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+[^\n:]+:\s*$",
    re.IGNORECASE
)

# "INHALT" auch gesperrt (I N H A L T)
INHALT_HEADING_RE = re.compile(r"^\s*I\s*N\s*H\s*A\s*L\s*T\s*$", re.IGNORECASE)
PROTOKOLL_HEADING_RE = re.compile(r"^\s*Protokoll(\b|$)", re.IGNORECASE)

def looks_like_inhalt_heading(line: str) -> bool:
    t = _nfkc(line).strip()
    if INHALT_HEADING_RE.match(t):
        return True
    return t.upper() == "INHALT"

def is_body_start_line(line: str) -> bool:
    t = _nfkc(line).rstrip()
    if PROTOKOLL_HEADING_RE.match(t):
        return True
    if HEADER_LINE_RE.match(t):
        return True
    return False

def split_toc_and_body(
    flat_lines: List[Dict[str, Any]],
    stop_at_first_body_header: bool = True
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Trennt TOC-Zeilen und Body-Zeilen (Protokoll).
    Rückgabe: (toc_lines, body_lines, meta)
    meta = { "inhalt_found": bool, "body_start_index": int|None, "body_start_reason": "protokoll"|"role_header"|None }
    """
    toc_lines: List[Dict[str, Any]] = []
    body_lines: List[Dict[str, Any]] = []
    in_toc = False
    body_start_idx: Optional[int] = None
    body_start_reason: Optional[str] = None

    for idx, obj in enumerate(flat_lines):
        text = _nfkc(obj.get("text") or "")
        # leere Zeilen behalten wir im aktuellen Modus
        if not text.strip():
            if in_toc:
                toc_lines.append(obj)
            else:
                body_lines.append(obj)
            continue

        if not in_toc:
            if looks_like_inhalt_heading(text):
                in_toc = True
                toc_lines.append(obj)
                continue
            if is_body_start_line(text):
                body_start_idx = idx
                body_start_reason = "protokoll" if PROTOKOLL_HEADING_RE.match(text) else "role_header"
                body_lines.extend(flat_lines[idx:])
                break
            # Kopfbereich ignorieren
            continue

        # Wir sind im TOC-Bereich
        if PROTOKOLL_HEADING_RE.match(text):
            body_start_idx = idx
            body_start_reason = "protokoll"
            body_lines.extend(flat_lines[idx:])
            break

        if stop_at_first_body_header and HEADER_LINE_RE.match(text):
            body_start_idx = idx
            body_start_reason = "role_header"
            body_lines.extend(flat_lines[idx:])
            break

        toc_lines.append(obj)

    # Falls wir bis zum Ende im TOC waren und keinen Body-Start fanden: body bleibt leer
    if not in_toc and not body_lines:
        # Kein TOC gefunden -> gesamter Input ist Body
        body_lines = list(flat_lines)

    meta = {
        "inhalt_found": in_toc,
        "body_start_index": body_start_idx,
        "body_start_reason": body_start_reason
    }
    return toc_lines, body_lines, meta

# TOC-Parsing (strukturierte Punkte)

DASH_SPLIT_RE = re.compile(r"\s*[–—-]\s*")
DRS_RE = re.compile(r"(?:Drucksache|Drs\.)\s*(\d+/\d+)", re.IGNORECASE)
PARTY_PATTERN = r"(?:AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)"
ROLE_PATTERN = r"(?:Abg\.|Präsident(?:in)?|Vizepräsident(?:in)?|Ministerpräsident(?:in)?|Minister(?:in)?|Staatssekretär(?:in)?)"

# Nummerierter Header-Beginn: "1. <Text>"
NUMBERED_START_RE = re.compile(r"^\s*(?P<num>\d{1,3})\.\s+(?P<body>.+)$")
# Unnummerierte Header-Hinweise
UNNUMBERED_HEADER_HINT_RE = re.compile(
    r"^(Aktuelle\s+Debatte|Fragestunde|Eröffnung|Bekanntgabe|Tagesordnung|Anträge|Antrag|Bericht|Wahl)\b",
    re.IGNORECASE
)
# Sprecher-Zeilen (Redereihenfolge) im TOC
SPEAKER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+(?P<name>[^.,\d][^.\d]*?)(?:\s+(?P<party>{PARTY_PATTERN}))?\s*(?:[.\s]{{2,}}\d+(?:\s*,\s*\d+)*)?\s*$",
    re.IGNORECASE
)
# Subentry "Beschlussempfehlung..." / "Bericht..." / "Beschluss" optional mit DS
SUBENTRY_WITH_DRS_RE = re.compile(
    rf"^(?P<text>Beschlussempfehlung.+?|Bericht.+?|Beschluss)\s*(?:{DASH_SPLIT_RE.pattern}(?:Drucksache|Drs\.)\s*(?P<ds>\d+/\d+))?$",
    re.IGNORECASE
)
# Seitenzahlen am Ende entfernen
TRAILING_PAGES_RE = re.compile(r"\s+\d{3,5}(?:\s*,\s*\d{3,5})*\s*$")

def _cleanup_line(s: str) -> str:
    s = _nfkc(s)
    s = s.replace(ELLIPSIS, ".")
    s = DOT_LEADERS.sub(" ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()

def _strip_trailing_pages(s: str) -> str:
    return TRAILING_PAGES_RE.sub("", s).strip(" –—- ").strip()

def _normalize_party(p: Optional[str]) -> Optional[str]:
    if not p:
        return p
    p = p.replace("GRUENE", "GRÜNE")
    p = re.sub(r"\s+", " ", p).strip()
    return p

def _find_all_drs(text: str) -> List[str]:
    return list(dict.fromkeys(DRS_RE.findall(text)))  # de-dupe, preserve order

def _looks_like_subentry(text: str) -> bool:
    return bool(SUBENTRY_WITH_DRS_RE.match(text))

def _parse_subentry(text: str) -> Tuple[str, List[str]]:
    m = SUBENTRY_WITH_DRS_RE.match(text)
    if not m:
        return text, []
    sub_text = m.group("text") or text
    ds = []
    if m.group("ds"):
        ds = [m.group("ds")]
    more = _find_all_drs(text)
    for d in more:
        if d not in ds:
            ds.append(d)
    return sub_text.strip(), ds

def _looks_like_speaker(text: str) -> bool:
    return bool(SPEAKER_LINE_RE.match(text))

def _parse_speaker_line(text: str) -> Optional[Dict[str, Any]]:
    m = SPEAKER_LINE_RE.match(text)
    if not m:
        return None
    return {
        "role": m.group("role"),
        "name": (m.group("name") or "").strip(),
        "party": _normalize_party(m.group("party"))
    }

def _parse_header(header_text: str) -> Tuple[Optional[str], str, Optional[str], List[str]]:
    """
    Versucht, 'kind' (z. B. 'Aktuelle Debatte') zu erkennen.
    Gibt (kind, title, extra, drs_list) zurück.
    """
    text = header_text
    ds_list = _find_all_drs(text)
    if ds_list:
        text = DRS_RE.sub("", text).strip(" –—-")

    # heuristische Erkennung des "Kind"
    kind_patterns = [
        r"Aktuelle Debatte", r"Erste Beratung", r"Zweite Beratung", r"Dritte Beratung",
        r"Fragestunde", r"Regierungserklärung", r"Wahl", r"Antrag", r"Bericht", r"Tagesordnung"
    ]
    kind = None
    for pat in kind_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            kind = m.group(0)
            # Titel = Rest ohne das erkannte "Kind" und evtl. Trennstrich
            rest = text[:m.start()] + text[m.end():]
            # Trennstriche entfernen
            rest = DASH_SPLIT_RE.sub(" ", rest).strip(" –—- ")
            title = rest if rest else text
            return kind, title.strip(), None, ds_list

    # kein Kind erkannt
    return None, text.strip(), None, ds_list

def parse_toc(flat_lines: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parst die übergebenen TOC-Zeilen in strukturierte Tagesordnung.
    Erwartet nur die TOC-Seiten (oder einen entsprechend herausgefilterten Ausschnitt).
    Ausgabeformat:
      { "items": [ { number, kind, title, drucksachen, extra, subentries: [{text, drucksachen}], speakers: [{role,name,party}], raw_header, raw_lines } ] }
    """
    items: List[Dict[str, Any]] = []
    i = 0
    n = len(flat_lines)
    current: Optional[Dict[str, Any]] = None

    while i < n:
        raw = (flat_lines[i].get("text") or "")
        raw = _nfkc(raw)
        text = _cleanup_line(raw)
        if not text:
            i += 1
            continue

        # 1) Neuer nummerierter TOP?
        m_num = NUMBERED_START_RE.match(text)
        if m_num:
            # Vorherigen abschließen
            if current:
                items.append(current)
                current = None

            num = int(m_num.group("num"))
            body_first = m_num.group("body").strip()
            header_lines = [body_first]

            # Mehrzeilige Header fortsetzen, bis Subentry/Sprecher/neuer TOP
            j = i + 1
            while j < n:
                nxt_raw = _nfkc(flat_lines[j].get("text") or "")
                nxt = _cleanup_line(nxt_raw)
                if not nxt:
                    break
                if NUMBERED_START_RE.match(nxt):
                    break
                if _looks_like_subentry(nxt) or _looks_like_speaker(nxt):
                    break
                header_lines.append(nxt)
                j += 1

            header_text = " ".join(header_lines).strip()
            header_text = _strip_trailing_pages(header_text)
            kind, title, extra, drs_list = _parse_header(header_text)

            current = {
                "number": num,
                "kind": kind,
                "title": title,
                "drucksachen": drs_list,
                "extra": extra,
                "subentries": [],
                "speakers": [],
                "raw_header": header_text,
                "raw_lines": [text] + header_lines[1:]
            }
            i = j
            continue

        # 2) Unnummerierter Einzelpunkt-Header?
        if current is None and UNNUMBERED_HEADER_HINT_RE.match(text) and not _looks_like_subentry(text) and not _looks_like_speaker(text):
            header_lines = [text]
            j = i + 1
            while j < n:
                nxt_raw = _nfkc(flat_lines[j].get("text") or "")
                nxt = _cleanup_line(nxt_raw)
                if not nxt:
                    break
                if NUMBERED_START_RE.match(nxt):
                    break
                if _looks_like_subentry(nxt) or _looks_like_speaker(nxt):
                    break
                header_lines.append(nxt)
                j += 1

            header_text = " ".join(header_lines).strip()
            header_text = _strip_trailing_pages(header_text)
            kind, title, extra, drs_list = _parse_header(header_text)

            current = {
                "number": None,
                "kind": kind,
                "title": title,
                "drucksachen": drs_list,
                "extra": extra,
                "subentries": [],
                "speakers": [],
                "raw_header": header_text,
                "raw_lines": header_lines[:]
            }
            i = j
            continue

        # Ab hier müssen wir innerhalb eines laufenden Items sein, sonst ignorieren
        if current is None:
            i += 1
            continue

        # 3) Subentry (Beschlussempfehlung / Bericht / Beschluss)
        if _looks_like_subentry(text):
            sub_text, ds = _parse_subentry(text)
            current["subentries"].append({
                "text": sub_text,
                "drucksachen": ds
            })
            current["raw_lines"].append(text)
            i += 1
            continue

        # 4) Sprecherzeile (Redereihenfolge)
        if _looks_like_speaker(text):
            sp = _parse_speaker_line(text)
            if sp:
                current["speakers"].append(sp)
                current["raw_lines"].append(text)
            i += 1
            continue

        # 5) Anderes: ggf. als 'extra' anhängen und DS extrahieren
        if text and text not in current["raw_lines"]:
            ds_more = _find_all_drs(text)
            if ds_more:
                for d in ds_more:
                    if d not in current["drucksachen"]:
                        current["drucksachen"].append(d)
                text_wo_drs = DRS_RE.sub("", text).strip(" –—-")
                if text_wo_drs:
                    current["extra"] = (current.get("extra") + " " + text_wo_drs).strip() if current.get("extra") else text_wo_drs
            else:
                current["extra"] = (current.get("extra") + " " + text).strip() if current.get("extra") else text
            current["raw_lines"].append(text)
        i += 1

    # Finalisieren
    if current:
        items.append(current)

    # Normalisierung: Partei-Namen und leere Strings säubern
    for it in items:
        if it.get("extra"):
            it["extra"] = it["extra"].strip(" –—-")
        if not it.get("extra"):
            it["extra"] = None
        for sp in it.get("speakers", []):
            sp["party"] = _normalize_party(sp.get("party"))

    return { "items": items }

# ------------------------- Hilfen: Pages -> flat_lines -------------------------

def pages_to_flat_lines(pages_lines: List[List[str]]) -> List[Dict[str, Any]]:
    """
    Baut flache Zeilenobjekte:
      [{ "page": int, "line_index": int, "text": str }, ...]
    Leere Zeilen werden beibehalten (wichtig für TOC-Abschluss).
    """
    flat: List[Dict[str, Any]] = []
    for p_idx, lines in enumerate(pages_lines, start=1):
        for i, t in enumerate(lines):
            flat.append({"page": p_idx, "line_index": i, "text": t})
    return flat

# ------------------------- Legacy TOC (nur Referenz, nicht genutzt) -------------------------

TOC_HEADER_RX = re.compile(r"^\s*(I\s*N\s*H\s*A\s*L\s*T|INHALT)\s*$", re.IGNORECASE)
PAGE_ONLY_RX = re.compile(r"^\s*\d{3,5}\s*$")
AGENDA_NUM_RX = re.compile(r"^\s*(\d+)\.\s+(.*)$")
AGENDA_KEYWORDS_RX = re.compile(r"\b(Beschluss|Beschlussempfehlung|Zweite Beratung|Aktuelle Debatte|Erste Beratung|Dritte Beratung)\b", re.IGNORECASE)
DRS_RX_LEGACY = re.compile(r"(?:Drucksache|Drs\.)\s*(\d+/\d+)", re.IGNORECASE)

SPEAKER_RX_LEGACY = re.compile(
    r"^\s*(Abg\.|Präsidentin|Präsident|Vizepräsidentin|Vizepräsident|Minister(?:in)?|Staatssekretär(?:in)?)\s+"
    r"(.{1,120}?)"
    r"(?:\s+\(?(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)\)?)?"
    r"\s*(?:\.{2,}|\s+)\s*(\d{1,4}(?:\s*,\s*\d{1,4})*)\s*$",
    re.IGNORECASE
)
BESCHLUSS_RX = re.compile(r"Beschluss\s*\.{2,}\s*(\d{4})", re.IGNORECASE)

def strip_trailing_pages_and_dots(s: str) -> str:
    s = DOT_LEADERS.sub(" ", s.replace(ELLIPSIS, " "))
    s = re.sub(r"\s+\d{3,5}(?:\s*,\s*\d{3,5})*\s*$", "", s)
    s = re.sub(r"[ .–-]+$", "", s)
    return re.sub(r"\s{2,}", " ", s).strip()

def assemble_toc_from_pages(pages_lines: List[List[str]], look_pages: int = 3) -> List[Dict[str, Any]]:
    # Legacy-Funktion – belassen zur Referenz, aber nicht mehr genutzt.
    if not pages_lines:
        return []
    first_pages: List[str] = []
    for lines in pages_lines[:look_pages]:
        first_pages.extend(lines)
    start = 0
    for i, l in enumerate(first_pages):
        if TOC_HEADER_RX.match(l):
            start = i + 1
            break
    lines = first_pages[start:]
    items: List[Dict[str, Any]] = []
    cur_item: Optional[Dict[str, Any]] = None
    cur_title: List[str] = []
    cur_subtitle: List[str] = []
    cur_speakers: List[Dict[str, Any]] = []
    cur_beschluss: Optional[str] = None
    in_subtitle = False

    for ln in lines:
        if not ln.strip():
            if cur_item:
                cur_item["title"] = strip_trailing_pages_and_dots(" ".join(cur_title))
                cur_item["subtitle"] = strip_trailing_pages_and_dots(" ".join(cur_subtitle)) if cur_subtitle else None
                cur_item["speakers"] = cur_speakers
                cur_item["beschluss"] = cur_beschluss
                drs = DRS_RX_LEGACY.findall(cur_item["title"] or "") + DRS_RX_LEGACY.findall(cur_item["subtitle"] or "")
                if drs:
                    cur_item["docket"] = drs[-1]
                items.append(cur_item)
                cur_item = None
                cur_title = []
                cur_subtitle = []
                cur_speakers = []
                cur_beschluss = None
                in_subtitle = False
            continue

        mnum = AGENDA_NUM_RX.match(ln)
        is_keyword = bool(AGENDA_KEYWORDS_RX.search(ln))
        m_speaker = SPEAKER_RX_LEGACY.match(ln)
        m_beschluss = BESCHLUSS_RX.match(ln)

        if mnum or is_keyword:
            if cur_item:
                cur_item["title"] = strip_trailing_pages_and_dots(" ".join(cur_title))
                cur_item["subtitle"] = strip_trailing_pages_and_dots(" ".join(cur_subtitle)) if cur_subtitle else None
                cur_item["speakers"] = cur_speakers
                cur_item["beschluss"] = cur_beschluss
                drs = DRS_RX_LEGACY.findall(cur_item["title"] or "") + DRS_RX_LEGACY.findall(cur_item["subtitle"] or "")
                if drs:
                    cur_item["docket"] = drs[-1]
                items.append(cur_item)
            cur_item = {"number": int(mnum.group(1)) if mnum else None, "title": "", "subtitle": None, "docket": None, "speakers": [], "beschluss": None}
            cur_title = [mnum.group(2) if mnum else ln]
            cur_subtitle = []
            cur_speakers = []
            cur_beschluss = None
            in_subtitle = False

        elif m_speaker:
            role = m_speaker.group(1)
            name = m_speaker.group(2).strip()
            party = m_speaker.group(3)
            pages_str = m_speaker.group(4)
            cur_speakers.append({"role": role, "name": name, "party": party, "pages": pages_str})

        elif m_beschluss:
            cur_beschluss = m_beschluss.group(1)

        else:
            if "Drucksache" in ln or "Drs." in ln or "beantragt von" in ln:
                in_subtitle = True
            if in_subtitle:
                joiner = " " if not cur_subtitle or not cur_subtitle[-1].endswith("-") else ""
                if cur_subtitle:
                    cur_subtitle[-1] = (cur_subtitle[-1].rstrip("-") + joiner + strip_trailing_pages_and_dots(ln)).strip()
                else:
                    cur_subtitle = [strip_trailing_pages_and_dots(ln)]
            else:
                joiner = " " if not cur_title or not cur_title[-1].endswith("-") else ""
                if cur_title:
                    cur_title[-1] = (cur_title[-1].rstrip("-") + joiner + strip_trailing_pages_and_dots(ln)).strip()
                else:
                    cur_title = [strip_trailing_pages_and_dots(ln)]

    if cur_item:
        cur_item["title"] = strip_trailing_pages_and_dots(" ".join(cur_title))
        cur_item["subtitle"] = strip_trailing_pages_and_dots(" ".join(cur_subtitle)) if cur_subtitle else None
        cur_item["speakers"] = cur_speakers
        cur_item["beschluss"] = cur_beschluss
        drs = DRS_RX_LEGACY.findall(cur_item["title"] or "") + DRS_RX_LEGACY.findall(cur_item["subtitle"] or "")
        if drs:
            cur_item["docket"] = drs[-1]
        items.append(cur_item)

    # Dedup
    dedup: List[Dict[str, Any]] = []
    seen = set()
    for it in items:
        key = (it.get("number"), (it["title"] or "").lower())
        if key in seen:
            if dedup:
                last = dedup[-1]
                last["speakers"].extend([s for s in it.get("speakers", []) if s not in last.get("speakers", [])])
            continue
        seen.add(key)
        dedup.append(it)
    return dedup

# ------------------------- Speeches (Body) -------------------------

HEADER_RX = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+(?P<name>[^:\n]{{1,160}}?)(?:\s+(?P<party>{PARTY_TOKENS}))?\s*:\s*$",
    re.IGNORECASE
)

def find_first_body_header(lines: List[str]) -> int:
    for i, l in enumerate(lines):
        if HEADER_RX.match(l):
            if re.match(r"^\s*Präsident", l, re.IGNORECASE):
                return i
            return i
    return 0

def segment_speeches_from_pages(pages: List[List[str]]) -> List[Dict[str, Any]]:
    # Flatten mit Seitenindex
    flat: List[Tuple[int, str]] = []
    for p_idx, lines in enumerate(pages, start=1):
        for l in lines:
            if l.strip():
                flat.append((p_idx, l))
    # Body-Beginn: suche erste Header-Zeile "Rolle Name ...:"
    start_idx = 0
    for i, (_p, t) in enumerate(flat):
        if HEADER_RX.match(t):
            if re.match(r"^\s*Präsident", t, re.IGNORECASE):
                start_idx = i
                break
            if start_idx == 0:
                start_idx = i
    body = flat[start_idx:] if start_idx < len(flat) else []
    speeches: List[Dict[str, Any]] = []
    cur: Optional[Dict[str, Any]] = None
    buf: List[str] = []

    def flush():
        nonlocal cur, buf
        if cur:
            text = "\n".join(buf).strip()
            text = re.sub(r"\n{3,}", "\n\n", text)
            cur["text"] = text
            speeches.append(cur)
            cur = None
            buf = []

    for p, line in body:
        m = HEADER_RX.match(line)
        if m:
            flush()
            role = m.group("role")
            name = m.group("name").strip()
            party = m.group("party")
            cur = {
                "index": len(speeches),
                "start_page": p,
                "speaker": f"{name}",
                "role": role,
                "party": (party or "").replace("GRUENE", "GRÜNE") if party else None,
                "text": ""
            }
        else:
            if cur:
                # Interjektionen in Klammern flach entfernen
                line_clean = re.sub(
                    r"\(([^()]{0,160}?(?:Beifall|Zuruf|Heiterkeit|Lachen|Unruhe|Zwischenruf|Widerspruch|Glocke|Zurufe)[^()]*)\)",
                    " ",
                    line,
                )
                buf.append(line_clean)
    flush()
    # Re-index
    for i, sp in enumerate(speeches):
        sp["index"] = i
    return speeches

# ------------------------- Metadata helpers -------------------------

def parse_session_info(all_text: str) -> Dict[str, Any]:
    number = None
    m1 = re.search(r"(\d{1,3})\.\s*Sitzung", all_text)
    if m1:
        number = int(m1.group(1))
    leg = None
    m2 = re.search(r"(\d{1,2})\.\s*Wahlperiode", all_text)
    if m2:
        leg = int(m2.group(1))
    date = None
    m3 = re.search(r"(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})", all_text)
    MONTHS = {
        "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5, "juni": 6, "juli": 7,
        "august": 8, "september": 9, "oktober": 10, "november": 11, "dezember": 12
    }
    if m3:
        day = int(m3.group(1))
        mon = m3.group(2).lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
        year = int(m3.group(3))
        mm = MONTHS.get(mon)
        if mm:
            date = f"{year:04d}-{mm:02d}-{day:02d}"
    return {
        "number": number,
        "legislative_period": leg,
        "date": date
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
    # All text for metadata
    all_text = "\n".join("\n".join(p) for p in pages)
    meta = parse_session_info(all_text)
    meta["source_pdf_url"] = url
    meta["extracted_at"] = dt.datetime.utcnow().isoformat() + "Z"

    # Robustes TOC: flat_lines -> split -> parse
    flat = pages_to_flat_lines(pages)
    toc_lines, body_lines, _meta = split_toc_and_body(flat, stop_at_first_body_header=True)
    toc = {"items": []}
    if toc_lines:
        toc = parse_toc(toc_lines)

    # Speeches (bewährte Segmentierung beibehalten)
    speeches = segment_speeches_from_pages(pages)

    payload: Dict[str, Any] = {
        "session": {
            "number": meta.get("number"),
            "legislative_period": meta.get("legislative_period"),
            "date": meta.get("date"),
            "source_pdf_url": url,
            "extracted_at": meta.get("extracted_at")
        },
        "sitting": {
            "start_time": None,
            "end_time": None,
            "location": None
        },
        "stats": {
            "pages": len(pages),
            "speeches": len(speeches)
        },
        "layout": {
            "applied": True,
            "reason": "auto-detected-columns"
        },
        # Neuer, robuster TOC
        "toc": toc,
        # Legacy-Feld (nicht mehr befüllt): "toc_agenda": [],
        "speeches": speeches
    }
    # Sidecar (layout + normalized_pages)
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
    # move sidecar out
    sidecar = payload.pop("_layout_debug_internal", None)
    payload["schema_version"] = "1.0-minimal"
    with session_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    sidecar_path = None
    if sidecar is not None:
        sidecar_path = session_path.parent / layout_file
        with sidecar_path.open("w", encoding="utf-8") as f:
            json.dump({
                "session_ref": session_path.name,
                "schema_version": "1.0-layout-debug",
                "layout_debug": sidecar
            }, f, ensure_ascii=False, indent=2)
    return session_path, sidecar_path

# ------------------------- CLI -------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Parser: Robustes TOC + Speeches (inline, ohne Imports).")
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
        payload = process_pdf(url, force_download=args.force_download)
        sp, lp = write_outputs(payload, out_dir)
        print(f"[INFO] geschrieben: {sp.name} {'+' if lp else ''} {lp.name if lp else ''}")
    return 0

if __name__ == "__main__":
    sys.exit(main())

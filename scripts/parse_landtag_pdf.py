#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_landtag_pdf.py (robuster TOC-Parser + feste Mittel-Splittung, v3.2.0)

Änderungen in dieser Version:
- Spalten-Serialisierung immer mit fester Split-Position genau in der Seitenmitte (split_x = page_width / 2).
- Keine dynamische Spaltenerkennung mehr; jede Seite wird als Zweispalter behandelt.
- Robust: Vollbreiten-Blöcke (Überschriften etc.) werden erkannt und an passender Y-Position eingefügt.
- Kopf-/Fußzeilen-Filter und Hyphenation-Reparatur bleiben erhalten.
- Robuster TOC-Parser bleibt integriert; Speeches-Segmentierung toleranter.

NEU (v3.2.0):
- Header/Footer-Filter wird vor TOC/Speeches angewendet (finale Texte bereinigt, Debug zeigt Erkennung).
- Sitzungszeiten (Beginn/Schluss) und Ort (z. B. „Stuttgart“) werden aus dem Header extrahiert.
- TOC-Titel werden zeilenübergreifend zusammengeführt; Drs.-Angaben werden strukturiert angereichert.
- Parteienangaben in TOC-Speakern werden aus den Reden (Body) nachträglich ergänzt, wenn fehlend.
- Layout-Reason: "fixed-mid-split + header/footer-filter".
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
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
    """
    (Nicht mehr genutzt) Ehemalige Heuristik zur Spaltenerkennung.
    """
    return None

def _group_lines_by_y(words: List[dict], y_quant: float = 3.0) -> List[List[dict]]:
    buckets: Dict[int, List[dict]] = {}
    for w in words:
        yk = int(round(float(w.get("top", 0.0)) / y_quant))
        buckets.setdefault(yk, []).append(w)
    lines = []
    for yk in sorted(buckets.keys()):
        line = sorted(buckets[yk], key=lambda w: float(w.get("x0", 0.0)))
        lines.append(line)
    return lines

def _words_to_lines_text(words: List[dict]) -> List[str]:
    lines = _group_lines_by_y(words)
    out = []
    for line in lines:
        out.append(" ".join((w.get("text") or "").strip() for w in line if (w.get("text") or "").strip()))
    return out

# ------------------------- Feste Mittel-Splittung (Zweispalten-Serialisierung) -------------------------

COLUMN_MARGIN_PTS = 12.0  # Sicherheitsmarge um split_x für Vollbreiten-Erkennung
HF_TOP_N = 3
HF_BOTTOM_N = 3
HF_MIN_SHARE = 0.6

def _sort_words_reading_order(words: List[dict]) -> List[dict]:
    return sorted(words, key=lambda w: (float(w.get("top", 0.0)), float(w.get("x0", 0.0))))

def _assign_columns(words: List[dict], split_x: float, margin: float = COLUMN_MARGIN_PTS) -> Tuple[List[dict], List[dict], List[dict]]:
    """
    Teilt Wörter in linke/rechte Spalte sowie Vollbreite (full) ein.
    full: Wörter, die die Mitte (±margin) überdecken.
    """
    left: List[dict] = []
    right: List[dict] = []
    full: List[dict] = []
    left_boundary = split_x - margin
    right_boundary = split_x + margin
    for w in words:
        x0 = float(w.get("x0", 0.0))
        x1 = float(w.get("x1", 0.0))
        mid = (x0 + x1) * 0.5
        if x0 < left_boundary and x1 > right_boundary:
            full.append(w)
        elif mid < split_x - 0.5:
            left.append(w)
        elif mid > split_x + 0.5:
            right.append(w)
        else:
            full.append(w)
    return left, right, full

def _words_to_lines_with_y(words: List[dict], y_quant: float = 3.0) -> List[Tuple[float, str]]:
    if not words:
        return []
    groups = _group_lines_by_y(words, y_quant=y_quant)
    lines_with_y: List[Tuple[float, str]] = []
    for g in groups:
        g_sorted = sorted(g, key=lambda w: float(w.get("x0", 0.0)))
        y = float(min(float(w.get("top", 0.0)) for w in g_sorted))
        text = " ".join((w.get("text") or "").strip() for w in g_sorted if (w.get("text") or "").strip())
        if text:
            lines_with_y.append((y, text))
    lines_with_y.sort(key=lambda t: t[0])
    return lines_with_y

def _lines_only_text(lines_with_y: List[Tuple[float, str]]) -> List[str]:
    return [t for _, t in lines_with_y]

def _merge_hyphenation(lines: List[str]) -> List[str]:
    """
    Führt Zeilen zusammen, wenn die vorherige auf '-' endet und die nächste mit Kleinbuchstabe beginnt.
    Entfernt Soft-Hyphen (U+00AD).
    """
    out: List[str] = []
    for line in lines:
        if line is None:
            continue
        s = line.replace("\u00AD", "")
        if out:
            prev = out[-1]
            if prev.rstrip().endswith("-") and s and s[:1].islower():
                out[-1] = prev.rstrip().rstrip("-") + s.lstrip()
                continue
        out.append(s)
    return out

def _inject_fullwidth_blocks(
    left_lines_y: List[Tuple[float, str]],
    right_lines_y: List[Tuple[float, str]],
    full_lines_y: List[Tuple[float, str]]
) -> List[str]:
    """
    Vollbreiten-Zeilen werden anhand ihrer Y-Position in den Lesefluss einsortiert:
    - oberhalb der Spalten, zwischen den Spalten, unterhalb der Spalten.
    Reihenfolge: above, left, between, right, below. Zwischen Blöcken Leerzeilen.
    """
    def first_y(lines): return lines[0][0] if lines else math.inf
    def last_y(lines): return lines[-1][0] if lines else -math.inf

    l_first, r_first = first_y(left_lines_y), first_y(right_lines_y)
    l_last, r_last = last_y(left_lines_y), last_y(right_lines_y)
    col_first = min(l_first, r_first)
    col_last = max(l_last, r_last)

    above = [(y, t) for (y, t) in full_lines_y if y < col_first]
    between = [(y, t) for (y, t) in full_lines_y if col_first <= y <= col_last]
    below = [(y, t) for (y, t) in full_lines_y if y > col_last]

    above.sort(key=lambda x: x[0])
    between.sort(key=lambda x: x[0])
    below.sort(key=lambda x: x[0])

    result: List[str] = []
    if above:
        result.extend(_lines_only_text(above))
        result.append("")
    result.extend(_lines_only_text(left_lines_y))
    if left_lines_y:
        result.append("")
    if between:
        result.extend(_lines_only_text(between))
        result.append("")
    result.extend(_lines_only_text(right_lines_y))
    if right_lines_y:
        result.append("")
    if below:
        result.extend(_lines_only_text(below))
    return result

# ------------------------- extract_lines (mit fester Mittel-Splittung) -------------------------

def extract_lines(pdf_path: Path) -> Tuple[List[List[str]], List[PageMeta]]:
    pages_text: List[List[str]] = []
    metas: List[PageMeta] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            pw = float(page.width or 0.0)
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
            if not words:
                pages_text.append([])
                metas.append(PageMeta(page.page_number, "empty", 0.0, 2, 0.0, 0.0, 0, pw))
                continue

            # Fester Split exakt in der Mitte
            split_x = pw * 0.5
            # Immer als Zweispalter behandeln
            lw, rw, fw = _assign_columns(words, split_x, COLUMN_MARGIN_PTS)
            lw = _sort_words_reading_order(lw)
            rw = _sort_words_reading_order(rw)
            fw = _sort_words_reading_order(fw)

            left_lines_y = _words_to_lines_with_y(lw)
            right_lines_y = _words_to_lines_with_y(rw)
            full_lines_y = _words_to_lines_with_y(fw)

            lines = _inject_fullwidth_blocks(left_lines_y, right_lines_y, full_lines_y)
            # Fester Spaltentrenner (zusätzlich)
            if not (lines and lines[-1] == ""):
                lines.append("")

            # Hyphenation-Reparatur
            lines = _merge_hyphenation(lines)
            # Normalisierung (Punkte, Ellipsen, Whitespace) – leere Zeilen erhalten
            norm: List[str] = []
            for l in lines:
                if l == "":
                    norm.append("")
                    continue
                l2 = l.replace(ELLIPSIS, ".")
                l2 = DOT_LEADERS.sub(" ", l2)
                l2 = re.sub(r"\s+", " ", l2).strip()
                norm.append(l2)
            pages_text.append(norm)

            total = max(1, len(words))
            metas.append(PageMeta(
                page=page.page_number,
                method="two-column",
                split_x=float(round(split_x, 2)),
                columns=2,
                left_fraction=float(round(len(lw) / total, 3)),
                right_fraction=float(round(len(rw) / total, 3)),
                words=len(words),
                page_width=float(round(pw, 2))
            ))
    return pages_text, metas

# ------------------------- extract_lines_fixed_mid (einfachere 50:50) -------------------------

def extract_lines_fixed_mid(pdf_path: Path) -> Tuple[List[List[str]], List[PageMeta]]:
    pages_text: List[List[str]] = []
    metas: List[PageMeta] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            pw = float(page.width or 0.0)
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
            if not words:
                pages_text.append([])
                metas.append(PageMeta(page.page_number, "empty", 0.0, 2, 0.0, 0.0, 0, pw))
                continue

            # Fester Split exakt in der Mitte
            split_x = pw * 0.5

            # Linke/rechte Spalte strikt nach Mitte
            mids = [((float(w.get("x0", 0.0)) + float(w.get("x1", 0.0))) / 2.0) for w in words]
            left_words = [w for w, m in zip(words, mids) if m < split_x]
            right_words = [w for w, m in zip(words, mids) if m >= split_x]

            # Zeilenbildung pro Spalte
            left_lines = _words_to_lines_text(left_words)
            right_lines = _words_to_lines_text(right_words)

            # Zusammenbau: erst links, dann Leerzeile, dann rechts
            lines = left_lines + [""] + right_lines

            # Normalisierung (Ellipsen, Punkte, Whitespaces) – leere Zeilen beibehalten
            norm: List[str] = []
            for l in lines:
                if l == "":
                    norm.append("")
                    continue
                l2 = l.replace(ELLIPSIS, ".")
                l2 = DOT_LEADERS.sub(" ", l2)
                l2 = re.sub(r"\s+", " ", l2).strip()
                norm.append(l2)
            pages_text.append(norm)

            total = max(1, len(words))
            metas.append(PageMeta(
                page=page.page_number,
                method="two-column-fixed-mid",
                split_x=float(round(split_x, 2)),
                columns=2,
                left_fraction=float(round(len(left_words) / total, 3)),
                right_fraction=float(round(len(right_words) / total, 3)),
                words=len(words),
                page_width=float(round(pw, 2))
            ))
    return pages_text, metas

# ------------------------- Header/Footer-Filter -------------------------

_HF_SANITIZE_NUMBERS = re.compile(r"\b\d{1,5}\b")

def _nfkc(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "")

def _normalize_for_header_footer(s: str) -> str:
    s = _nfkc(s)
    s = re.sub(r"\s+", " ", s).strip()
    s = _HF_SANITIZE_NUMBERS.sub("", s)
    s = s.strip(" –—-•,.;:")
    return s

def filter_repeating_headers_footers(
    pages_lines: List[List[str]],
    top_n: int = HF_TOP_N,
    bottom_n: int = HF_BOTTOM_N,
    min_share: float = HF_MIN_SHARE
) -> Tuple[List[List[str]], Dict[str, Any]]:
    if not pages_lines:
        return pages_lines, {"headers": [], "footers": []}

    total_pages = len(pages_lines)
    top_counts: Dict[str, int] = {}
    bottom_counts: Dict[str, int] = {}
    raw_examples_top: Dict[str, str] = {}
    raw_examples_bottom: Dict[str, str] = {}

    for lines in pages_lines:
        tops = [ln for ln in lines[:top_n] if ln.strip()]
        bots = [ln for ln in lines[-bottom_n:] if ln.strip()]
        for ln in tops:
            key = _normalize_for_header_footer(ln)
            if not key:
                continue
            top_counts[key] = top_counts.get(key, 0) + 1
            raw_examples_top.setdefault(key, ln)
        for ln in bots:
            key = _normalize_for_header_footer(ln)
            if not key:
                continue
            bottom_counts[key] = bottom_counts.get(key, 0) + 1
            raw_examples_bottom.setdefault(key, ln)

    header_keys = {k for k, c in top_counts.items() if c / total_pages >= min_share}
    footer_keys = {k for k, c in bottom_counts.items() if c / total_pages >= min_share}

    filtered: List[List[str]] = []
    for lines in pages_lines:
        new_lines: List[str] = []
        for idx, ln in enumerate(lines):
            key = _normalize_for_header_footer(ln)
            is_top_region = idx < top_n
            is_bottom_region = idx >= max(0, len(lines) - bottom_n)
            if is_top_region and key in header_keys:
                continue
            if is_bottom_region and key in footer_keys:
                continue
            new_lines.append(ln)
        filtered.append(new_lines)

    debug = {
        "headers": [raw_examples_top[k] for k in header_keys],
        "footers": [raw_examples_bottom[k] for k in footer_keys],
    }
    return filtered, debug

# ------------------------- Robust TOC splitter & parser (inline) -------------------------

# Header-Erkennung (Body-Start)
ROLE_TOKENS = [
    r"Abg\.", r"Präsidentin", r"Präsident", r"Vizepräsidentin", r"Vizepräsident",
    r"Ministerpräsident(?:in)?", r"Minister(?:in)?", r"Staatssekretär(?:in)?"
]
PARTY_TOKENS = r"(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)"
# Toleranter: erlaubt Text nach dem Doppelpunkt
HEADER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+[^\n:]+:\s*(?:\S.*)?$",
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
        if not text.strip():
            if in_toc:
                toc_lines.append(obj)
            else:
                body_lines.append(obj)
            continue

        if not in_toc:
            # 1) Standard: explizite Überschrift "INHALT" (auch gesperrt) startet den TOC
            if looks_like_inhalt_heading(text):
                in_toc = True
                toc_lines.append(obj)
                continue

            # 2) Heuristik: Falls "INHALT" (noch) fehlt, aber sehr früh (Seite 1–2)
            # schon eine nummerierte TOP-Zeile mit Seitenzahl(en) am Ende steht,
            # beginne TOC trotzdem (Layout: linke Spalte mit 1., 2., 3., Überschrift kommt rechts/weiter unten).
            if obj.get("page", 9999) <= 2:
                if NUMBERED_START_RE.match(text) and re.search(r"\d{3,5}\s*(?:,\s*\d{3,5})*\s*$", text):
                    in_toc = True
                    toc_lines.append(obj)
                    continue

            if is_body_start_line(text):
                body_start_idx = idx
                body_start_reason = "protokoll" if PROTOKOLL_HEADING_RE.match(text) else "role_header"
                body_lines.extend(flat_lines[idx:])
                break
            continue

        # im TOC-Bereich
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
NUMBERED_START_RE = re.compile(r"^\s*(\d+)\.\s+(.*)$")
SUBENTRY_WITH_DRS_RE = re.compile(
    rf"^(?P<text>Beschlussempfehlung.+?|Bericht.+?|Beschluss)\s*(?:{DASH_SPLIT_RE.pattern}(?:Drucksache|Drs\.)\s*(?P<ds>\d+/\d+))?$",
    re.IGNORECASE
)
TRAILING_PAGES_RE = re.compile(r"\s+\d{3,5}(?:\s*,\s*\d{3,5})*\s*$")
TOC_HEADER_RX = re.compile(r"^\s*(Inhalt|I\s*N\s*H\s*A\s*L\s*T)\s*$", re.IGNORECASE)

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

def _infer_kind_from_header(header_text: str) -> Tuple[Optional[str], str, List[str]]:
    """
    Entfernt Drs.-Angaben aus header_text, heuristisch 'kind' erkennen und Drs-Liste zurückliefern.
    """
    text = header_text
    ds_list = _find_all_drs(text)
    if ds_list:
        text = DRS_RE.sub("", text).strip(" –—-")
    kind_patterns = [
        r"Aktuelle Debatte", r"Erste Beratung", r"Zweite Beratung", r"Dritte Beratung",
        r"Fragestunde", r"Regierungserklärung", r"Wahl", r"Antrag", r"Bericht", r"Tagesordnung"
    ]
    kind = None
    for pat in kind_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            kind = m.group(0)
            break
    title = _strip_trailing_pages(text)
    return kind, title, ds_list

# Reden-Header: Erlaube Text nach dem Doppelpunkt (nicht nur Zeilenende)
SPEAKER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+(?P<name>[^:\n]{{1,160}}?)(?:\s+\(?(?P<party>{PARTY_PATTERN})\)?)?\s*(?::|\.\.\.|\.{{2,}})?\s*(?P<pages>\d{{1,4}}(?:\s*,\s*\d{{1,4}})*)?\s*$",
    re.IGNORECASE
)

def _join_title_parts(parts: List[str]) -> str:
    """
    Führt Titelteile zusammen (entfernt Seitenzahlen am Ende, repariert Silbentrennung).
    """
    res = ""
    for part in parts:
        p = _strip_trailing_pages(part or "").strip()
        if not p:
            continue
        if res.endswith("-") and p[:1].islower():
            res = res.rstrip("-") + p
        else:
            res = (res + " " + p).strip()
    # Nochmals säubern
    res = re.sub(r"\s{2,}", " ", res).strip()
    return res

def parse_toc(flat_lines: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parst die übergebenen TOC-Zeilen in strukturierte Tagesordnung.
    Erwartet nur die TOC-Seiten (oder einen entsprechend herausgefilterten Ausschnitt).
    Ausgabeformat:
      { "items": [ { number, kind, title, drucksachen, extra, subentries: [{text, drucksachen}], speakers: [{role,name,party,pages?}], raw_header, raw_lines } ] }
    """
    items: List[Dict[str, Any]] = []
    i = 0
    n = len(flat_lines)
    current: Optional[Dict[str, Any]] = None

    while i < n:
        raw = _nfkc(flat_lines[i].get("text") or "")
        text = _cleanup_line(raw)
        if not text:
            i += 1
            continue

        # Neuer nummerierter TOP?
        m_num = NUMBERED_START_RE.match(text)
        if m_num:
            if current:
                # finalize previous item
                if current.get("_title_parts"):
                    current["title"] = _join_title_parts(current["_title_parts"])
                current.pop("_title_parts", None)
                current.pop("_in_header", None)
                items.append(current)
            num = int(m_num.group(1))
            rest = m_num.group(2).strip()
            kind, title, ds_list = _infer_kind_from_header(rest)
            current = {
                "number": num,
                "kind": kind,
                "title": title,
                "drucksachen": ds_list or [],
                "extra": None,
                "subentries": [],
                "speakers": [],
                "raw_header": text,
                "raw_lines": [],
                "_title_parts": [title] if title else [],
                "_in_header": True
            }
            i += 1
            continue

        # Subentry mit optionaler Drs.
        if current and SUBENTRY_WITH_DRS_RE.match(text):
            m = SUBENTRY_WITH_DRS_RE.match(text)
            sub_text = _strip_trailing_pages(m.group("text") or "").strip(" –—-")
            ds = m.group("ds")
            se = {"text": sub_text}
            if ds:
                se["drucksachen"] = [ds]
            current["subentries"].append(se)
            current["raw_lines"].append(text)
            current["_in_header"] = False
            i += 1
            continue

        # Speaker-Zeile (Rolle Name (Partei) ... Seiten)
        if current:
            msp = SPEAKER_LINE_RE.match(text)
            if msp:
                role = msp.group("role")
                name = (msp.group("name") or "").strip()
                party = _normalize_party(msp.group("party"))
                pages_str = (msp.group("pages") or "").strip()
                current["speakers"].append({
                    "role": role,
                    "name": name,
                    "party": party,
                    "pages": pages_str if pages_str else None
                })
                current["raw_lines"].append(text)
                current["_in_header"] = False
                i += 1
                continue

        # Zusätzliche Zeilen:
        if current:
            # Wenn wir noch im Headerblock sind (vor Subentries/Speakern), erweitern wir den Titel
            if current.get("_in_header"):
                ds_more = _find_all_drs(text)
                for d in ds_more:
                    if d not in current["drucksachen"]:
                        current["drucksachen"].append(d)
                text_wo_drs = DRS_RE.sub("", text).strip(" –—-")
                if text_wo_drs:
                    current["_title_parts"].append(text_wo_drs)
                    current["title"] = _join_title_parts(current["_title_parts"])
                current["raw_lines"].append(text)
            else:
                # nach Headerblock: in 'extra' sammeln (als einfacher Fließtext)
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

    if current:
        if current.get("_title_parts"):
            current["title"] = _join_title_parts(current["_title_parts"])
        current.pop("_title_parts", None)
        current.pop("_in_header", None)
        items.append(current)

    # Normalisierung: Partei-Namen säubern, leere Strings entfernen
    for it in items:
        if it.get("extra"):
            it["extra"] = it["extra"].strip(" –—-")
        else:
            it["extra"] = None
        for sp in it.get("speakers", []):
            sp["party"] = _normalize_party(sp.get("party"))

    return {"items": items}

# ------------------------- Legacy-TOC (Referenz, nicht genutzt) -------------------------

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
            party = _normalize_party(m_speaker.group(3))
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

    # Dedup by (number, title)
    dedup: List[Dict[str, Any]] = []
    seen = set()
    for it in items:
        key = (it.get("number"), (it.get("title") or "").lower())
        if key in seen:
            if dedup:
                last = dedup[-1]
                last["speakers"].extend([s for s in it.get("speakers", []) if s not in last.get("speakers", [])])
            continue
        seen.add(key)
        dedup.append(it)
    return dedup

# ------------------------- Speeches (Body) -------------------------

# Toleranter: erlaubt Text nach dem Doppelpunkt
HEADER_RX = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+(?P<name>[^:\n]{{1,160}}?)(?:\s+(?P<party>{PARTY_TOKENS}))?\s*:\s*(?:\S.*)?$",
    re.IGNORECASE
)

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

BEGINN_RE = re.compile(r"Beginn\s+(\d{1,2})[:.]?(\d{2})\s*Uhr", re.IGNORECASE)
SCHLUSS_RE = re.compile(r"Schluss\s+(\d{1,2})[:.]?(\d{2})\s*Uhr", re.IGNORECASE)

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
    # Beginn/Schluss
    start_time = None
    end_time = None
    m_beg = BEGINN_RE.search(all_text)
    if m_beg:
        hh, mm = int(m_beg.group(1)), int(m_beg.group(2))
        start_time = f"{hh:02d}:{mm:02d}"
    m_end = SCHLUSS_RE.search(all_text)
    if m_end:
        hh, mm = int(m_end.group(1)), int(m_end.group(2))
        end_time = f"{hh:02d}:{mm:02d}"
    # Ort (einfach: Stuttgart, falls vorhanden)
    location = None
    m_loc = re.search(r"\bStuttgart\b", all_text)
    if m_loc:
        location = "Stuttgart"

    return {
        "number": number,
        "legislative_period": leg,
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "location": location
    }

# ------------------------- Flat-lines helper -------------------------

def pages_to_flat_lines(pages: List[List[str]]) -> List[Dict[str, Any]]:
    flat: List[Dict[str, Any]] = []
    for pi, lines in enumerate(pages, start=1):
        for li, t in enumerate(lines):
            flat.append({"page": pi, "line_index": li, "text": t})
    return flat

# ------------------------- Party enrichment -------------------------

def _normalize_person_name(n: Optional[str]) -> Optional[str]:
    if not n:
        return n
    n2 = unicodedata.normalize("NFKC", n)
    n2 = re.sub(r"\s+", " ", n2).strip()
    return n2

def enrich_toc_parties_from_speeches(toc: Dict[str, Any], speeches: List[Dict[str, Any]]) -> None:
    # Index: Name -> Party (erste gefundene Party gewinnt)
    idx: Dict[str, str] = {}
    for sp in speeches:
        name = _normalize_person_name(sp.get("speaker"))
        party = _normalize_party(sp.get("party"))
        if name and party and name not in idx:
            idx[name] = party
    for item in toc.get("items", []):
        for s in item.get("speakers", []):
            if not s.get("party"):
                n = _normalize_person_name(s.get("name"))
                if n and n in idx:
                    s["party"] = idx[n]

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

    # NEU: feste 50:50-Extraktion
    pages_raw, metas = extract_lines_fixed_mid(pdf_path)

    # Header/Footer-Filter vor Parsing anwenden
    pages_filtered, hf_debug = filter_repeating_headers_footers(pages_raw, top_n=HF_TOP_N, bottom_n=HF_BOTTOM_N, min_share=HF_MIN_SHARE)

    # All text for metadata (bereinigt)
    all_text = "\n".join("\n".join(p) for p in pages_filtered)
    meta = parse_session_info(all_text)
    meta["source_pdf_url"] = url
    meta["extracted_at"] = dt.datetime.utcnow().isoformat() + "Z"

    # TOC/Speeches auf den bereinigten Seiten
    flat = pages_to_flat_lines(pages_filtered)
    toc_lines, body_lines, _meta = split_toc_and_body(flat, stop_at_first_body_header=True)
    toc = {"items": []}
    if toc_lines:
        toc = parse_toc(toc_lines)
    speeches = segment_speeches_from_pages(pages_filtered)

    # Parteien in TOC aus den Reden nachpflegen (falls fehlend)
    enrich_toc_parties_from_speeches(toc, speeches)

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
            "location": meta.get("location")
        },
        "stats": {"pages": len(pages_filtered), "speeches": len(speeches)},
        "layout": {
            "applied": True,
            "reason": "fixed-mid-split + header/footer-filter"
        },
        "toc": toc,
        "speeches": speeches
    }
    payload["_layout_debug_internal"] = {
        "layout_metadata": [m.__dict__ for m in metas],
        "normalized_pages": pages_raw,
        "filtered_pages": pages_filtered,
        "header_footer_filter": hf_debug
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
    p = argparse.ArgumentParser(description="Parser: Feste Mittel-Splittung (Zweispalter), robuster TOC + Speeches, Header/Footer-Filter.")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--single-url", help="PDF-URL oder lokaler Pfad")
    g.add_argument("--list-file", help="Datei mit Zeilenweise URLs")
    p.add_argument("--force-download", action="store_true")
    p.add_argument("--out-dir", default="out", help="Ausgabeverzeichnis (Default: out)")
    return p.parse_args()

def gather_urls(args) -> List[str]:
    if args.single_url:
        return [args.single_url.strip()]
    urls: List[str] = []
    with open(args.list_file, "r", encoding="utf-8") as f:
        for line in f:
            u = line.strip()
            if u and not u.startswith("#"):
                urls.append(u)
    return urls

def main():
    args = parse_args()
    out_dir = Path(args.out_dir)
    urls = gather_urls(args)
    for url in urls:
        try:
            payload = process_pdf(url, args.force_download)
            session_path, sidecar_path = write_outputs(payload, out_dir)
            print(f"[OK] {url} -> {session_path.name}" + (f" (+ {sidecar_path.name})" if sidecar_path else ""))
        except Exception as e:
            print(f"[ERROR] {url}: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()

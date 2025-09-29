#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_landtag_pdf.py (robuster TOC-Parser + feste Mittel-Splittung, v3.3.3)

Neu in v3.3.3:
- TOC-Backfill: Fehlende Redner pro TOP werden aus den tatsächlichen Reden
  (agenda_item_number) zurückgeschrieben (fix u. a. für TOP 3).
- Titel-Noise justiert: „Baden-Württemberg“ wird NICHT mehr entfernt; Sitzungs-Metadaten
  („127. Sitzung – Mittwoch, …“) werden verlässlich aus TOC-Titeln entfernt.
- Event-Erkennung erweitert: Zeilen, die mit „– Zuruf/Beifall/…“ beginnen (ohne Klammern),
  werden als Events klassifiziert und nicht als neuer Rede-Header interpretiert.
- Segmentierung: Zeilen, die mit „– “ beginnen, starten keine neue Rede.

Hinweis: v3.3.1/2-Hotfixes (konservative Dehyphenation, Datumsregex, Agenda-Erkennung,
TOC-Interleave-Fallback, Header/Footer-Filter) bleiben erhalten.
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

def _words_to_lines_with_xy(words: List[dict], y_quant: float = 3.0) -> List[Tuple[float, float, str]]:
    """Gruppiert Wörter zu Zeilen und gibt (y_min, x_min, text) zurück, sortiert nach (y,x)."""
    if not words:
        return []
    groups = _group_lines_by_y(words, y_quant=y_quant)
    out: List[Tuple[float, float, str]] = []
    for g in groups:
        g_sorted = sorted(g, key=lambda w: float(w.get("x0", 0.0)))
        y = float(min(float(w.get("top", 0.0)) for w in g_sorted))
        x = float(min(float(w.get("x0", 0.0)) for w in g_sorted))
        text = " ".join((w.get("text") or "").strip() for w in g_sorted if (w.get("text") or "").strip())
        text = text.replace(ELLIPSIS, ".")
        text = DOT_LEADERS.sub(" ", text)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            out.append((y, x, text))
    out.sort(key=lambda t: (t[0], t[1]))
    return out

# ------------------------- Feste Mittel-Splittung (Zweispalten-Serialisierung) -------------------------

COLUMN_MARGIN_PTS = 12.0
HF_TOP_N = 3
HF_BOTTOM_N = 3
HF_MIN_SHARE = 0.6

def _sort_words_reading_order(words: List[dict]) -> List[dict]:
    return sorted(words, key=lambda w: (float(w.get("top", 0.0)), float(w.get("x0", 0.0))))

def _assign_columns(words: List[dict], split_x: float, margin: float = COLUMN_MARGIN_PTS) -> Tuple[List[dict], List[dict], List[dict]]:
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

def _lines_only_text(lines_with_y: List[Tuple[float, str]]) -> List[str]:
    return [t for _, t in lines_with_y]

def _merge_hyphenation(lines: List[str]) -> List[str]:
    """
    Konservativ: Nur Zeilen zusammenführen, wenn die vorige auf '-' endet und die nächste mit kleinem Buchstaben beginnt.
    Entfernt Soft-Hyphen (U+00AD). KEINE Intra-Wort-Zusammenziehungen.
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

# ------------------------- extract_lines_fixed_mid -------------------------

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

            split_x = pw * 0.5
            mids = [((float(w.get("x0", 0.0)) + float(w.get("x1", 0.0))) / 2.0) for w in words]
            left_words = [w for w, m in zip(words, mids) if m < split_x]
            right_words = [w for w, m in zip(words, mids) if m >= split_x]

            left_lines = _words_to_lines_text(left_words)
            right_lines = _words_to_lines_text(right_words)

            lines = left_lines + [""] + right_lines

            norm: List[str] = []
            for l in lines:
                if l == "":
                    norm.append("")
                    continue
                l2 = l.replace(ELLIPSIS, ".")
                l2 = DOT_LEADERS.sub(" ", l2)
                l2 = re.sub(r"\s+", " ", l2).strip()
                norm.append(l2)
            pages_text.append(_merge_hyphenation(norm))

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
    top_n: int = 3,
    bottom_n: int = 3,
    min_share: float = 0.6,
    skip_first_n_pages: int = 0
) -> Tuple[List[List[str]], Dict[str, Any]]:
    if not pages_lines:
        return pages_lines, {"headers": [], "footers": []}

    total_pages = len(pages_lines)
    top_counts: Dict[str, int] = {}
    bottom_counts: Dict[str, int] = {}
    raw_examples_top: Dict[str, str] = {}
    raw_examples_bottom: Dict[str, str] = {}

    for pi, lines in enumerate(pages_lines, start=1):
        if pi <= skip_first_n_pages:
            continue
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

    header_keys = {k for k, c in top_counts.items() if c / max(1, total_pages - skip_first_n_pages) >= min_share}
    footer_keys = {k for k, c in bottom_counts.items() if c / max(1, total_pages - skip_first_n_pages) >= min_share}

    filtered: List[List[str]] = []
    for pi, lines in enumerate(pages_lines, start=1):
        if pi <= skip_first_n_pages:
            filtered.append(list(lines))
            continue
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

# ------------------------- Nachgelagerte Cleanup-Pipeline -------------------------

POST_HF_PATTERNS = [
    re.compile(r"^Landtag von Baden[- ]Württemberg\b", re.IGNORECASE),
    re.compile(r"^Wahlperiode\b", re.IGNORECASE),
    re.compile(r"^Plenarprotokoll\b", re.IGNORECASE),
    re.compile(r"^\(?Protokoll\)?$", re.IGNORECASE),
    re.compile(r"^[IVXLCM]{1,4}$"),
    re.compile(r"^\d{3,5}$"),
]

def dehyphenate_block(lines: List[str]) -> List[str]:
    return _merge_hyphenation(lines)

def post_cleanup_headers_footers(pages_lines: List[List[str]]) -> List[List[str]]:
    cleaned: List[List[str]] = []
    for page in pages_lines:
        new_lines = []
        for ln in page:
            t = _nfkc(ln).strip()
            if not t:
                continue
            if any(pat.search(t) for pat in POST_HF_PATTERNS):
                continue
            new_lines.append(ln)
        cleaned.append(new_lines)
    return cleaned

def _secondary_pipeline_after_layout(pages_lines: List[List[str]]) -> List[List[str]]:
    pages = [dehyphenate_block(p) for p in pages_lines]
    pages = post_cleanup_headers_footers(pages)
    return pages

# ------------------------- TOC splitter & parser -------------------------

ROLE_TOKENS = [
    r"Abg\.", r"Präsidentin", r"Präsident", r"Vizepräsidentin", r"Vizepräsident",
    r"Ministerpräsident(?:in)?", r"Minister(?:in)?", r"Staatssekretär(?:in)?"
]
PARTY_TOKENS = r"(AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)"

HEADER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+[^\n:]+:\s*(?:\S.*)?$",
    re.IGNORECASE
)

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

NUMBERED_START_RE = re.compile(r"^\s*(\d+)\.\s+(.*)$")

def split_toc_and_body(
    flat_lines: List[Dict[str, Any]],
    stop_at_first_body_header: bool = True
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    toc_lines: List[Dict[str, Any]] = []
    body_lines: List[Dict[str, Any]] = []
    in_toc = False
    body_start_idx: Optional[int] = None
    body_start_reason: Optional[str] = None

    def _lookahead_numbered(idx: int, max_ahead: int = 6, page_limit: int = 3) -> int:
        cnt = 0
        for j in range(1, max_ahead + 1):
            k = idx + j
            if k >= len(flat_lines):
                break
            obj2 = flat_lines[k]
            if obj2.get("page", 9999) > page_limit:
                break
            t2 = _nfkc(obj2.get("text") or "")
            if NUMBERED_START_RE.match(t2):
                cnt += 1
        return cnt

    for idx, obj in enumerate(flat_lines):
        text = _nfkc(obj.get("text") or "")
        if not text.strip():
            (toc_lines if in_toc else body_lines).append(obj)
            continue

        if not in_toc:
            if looks_like_inhalt_heading(text):
                in_toc = True
                toc_lines.append(obj)
                continue
            if obj.get("page", 9999) <= 3 and NUMBERED_START_RE.match(text):
                if _lookahead_numbered(idx, max_ahead=6, page_limit=3) >= 1:
                    in_toc = True
                    toc_lines.append(obj)
                    continue
            if is_body_start_line(text):
                body_start_idx = idx
                body_start_reason = "protokoll" if PROTOKOLL_HEADING_RE.match(text) else "role_header"
                body_lines.extend(flat_lines[idx:])
                break
            continue

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
        body_lines = list(flat_lines)

    meta = {
        "inhalt_found": in_toc,
        "body_start_index": body_start_idx,
        "body_start_reason": body_start_reason
    }
    return toc_lines, body_lines, meta

# ------------------------- TOC Parsing -------------------------

DASH_SPLIT_RE = re.compile(r"\s*[–—-]\s*")
DRS_RE = re.compile(r"(?:Drucksache|Drs\.)\s*(\d+/\d+)", re.IGNORECASE)
PARTY_PATTERN = r"(?:AfD|CDU|SPD|GRÜNE|GRUENE|FDP/DVP|FDP|BÜNDNIS\s+90/DIE\s+GRÜNEN)"
ROLE_PATTERN = r"(?:Abg\.|Präsident(?:in)?|Vizepräsident(?:in)?|Ministerpräsident(?:in)?|Minister(?:in)?|Staatssekretär(?:in)?)"
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
    return list(dict.fromkeys(DRS_RE.findall(text)))

def _infer_kind_from_header(header_text: str) -> Tuple[Optional[str], str, List[str]]:
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

SPEAKER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+(?P<name>[^:\n]{{1,160}}?)(?:\s+\(?(?P<party>{PARTY_PATTERN})\)?)?\s*(?::|\.\.\.|\.{{2,}})?\s*(?P<pages>\d{{1,4}}(?:\s*,\s*\d{{1,4}})*)?\s*$",
    re.IGNORECASE
)

def _join_title_parts(parts: List[str]) -> str:
    res = ""
    for part in parts:
        p = _strip_trailing_pages(part or "").strip()
        if not p:
            continue
        if res.endswith("-") and p[:1].islower():
            res = res.rstrip("-") + p
        else:
            res = (res + " " + p).strip()
    res = re.sub(r"\s{2,}", " ", res).strip()
    return res

def parse_toc(flat_lines: List[Dict[str, Any]]) -> Dict[str, Any]:
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

        m_num = NUMBERED_START_RE.match(text)
        if m_num:
            if current:
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

        if current:
            msp = SPEAKER_LINE_RE.match(text)
            if msp:
                role = msp.group("role")
                name = (msp.group("name") or "").strip()
                party = _normalize_party(msp.group("party"))
                pages_str = (msp.group("pages") or "").strip()
                pages = []
                if pages_str:
                    for p in re.split(r"[,\s]+", pages_str):
                        if p.isdigit():
                            pages.append(int(p))
                current["speakers"].append({
                    "role": role,
                    "name": name,
                    "party": party,
                    "pages": pages if pages else None
                })
                current["raw_lines"].append(text)
                current["_in_header"] = False
                i += 1
                continue

        if current:
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

    for it in items:
        it["extra"] = it.get("extra", None)
        for sp in it.get("speakers", []):
            sp["party"] = _normalize_party(sp.get("party"))

    return {"items": items}

# ------------------------- TOC-Normalisierung & Utilities -------------------------

RE_FILL_DOTS = re.compile(r"(?:\.\s*){2,}")
RE_ICH_RUFE_PUNKT = re.compile(r"\bIch\s*rufe\s+Punkt\s+(\d{1,2})\b", re.IGNORECASE)
RE_ICH_RUFE_TOP = re.compile(r"\bIch\s*rufe\s+(?:Tagesordnungspunkt|Punkt)\s+(\d{1,2})\b", re.IGNORECASE)
RE_DRUCKSACHE = re.compile(r"\b\d{2}/\d{4,}\b")
RE_URL = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
RE_NUMERIC_DATE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b")

def remove_fill_dots(s: str) -> str:
    return RE_FILL_DOTS.sub(" ", s).strip()

def normalize_party_in_name(name_with_party: str) -> Tuple[str, Optional[str]]:
    PARTY_ALIASES = {
        "GRÜNE": "GRÜNE",
        "GRUENE": "GRÜNE",
        "CDU": "CDU",
        "SPD": "SPD",
        "FDP/DVP": "FDP/DVP",
        "AFD": "AfD",
        "AFD.": "AfD",
    }
    s = remove_fill_dots(_nfkc(name_with_party))
    tokens = s.split()
    party = None
    for k in range(len(tokens) - 1, -1, -1):
        tok = tokens[k].upper().replace(",", "")
        if tok in PARTY_ALIASES:
            party = PARTY_ALIASES[tok]
            tokens = tokens[:k]
            break
    name = " ".join(tokens).strip(" ,.")
    return name, party

def extract_drucksachen_from_raw_lines(raw_lines: List[str]) -> List[str]:
    joined = " ".join([re.sub(r"\bD\s*r\s*u\s*c\s*k\s*s\s*a\s*c\s*h\s*e\b", "Drucksache", ln, flags=re.IGNORECASE) for ln in raw_lines])
    joined = re.sub(r"(\d{2})\s*/\s*(\d{4,})", r"\1/\2", joined)
    found = list(dict.fromkeys(RE_DRUCKSACHE.findall(joined)))
    return found

def _cleanup_toc_title_noise(title: str) -> str:
    s = RE_URL.sub("", title)
    s = RE_NUMERIC_DATE.sub("", s)
    # Flexibel „D rucksachen … Plenarprotokolle …“ entfernen
    s = re.sub(r"D\s*r\s*u\s*c\s*k\s*s\s*a\s*c\s*h\s*e\s*n\s*und\s*Plenarprotokolle.*?$", "", s, flags=re.IGNORECASE)
    # Recyclingpapier/Blauer Engel-Hinweis entfernen
    s = re.sub(r"Der\s+Landtag\s+druckt\s+auf\s+Recyclingpapier.*?$", "", s, flags=re.IGNORECASE)
    # Sitzungs-Meta („127. Sitzung – …“) am Ende entfernen
    s = re.sub(r"\b\d{1,3}\.\s*Sitzung\b.*?$", "", s, flags=re.IGNORECASE)
    # Generischer Hinweis auf „Drucksachen und Plenarprotokolle“
    s = re.sub(r"\bDrucksachen?\s*und\s*Plenarprotokolle?.*?$", "", s, flags=re.IGNORECASE)
    # Aufräumen
    s = re.sub(r"\s{2,}", " ", s).strip(" –—- ")
    return s.strip()

def looks_like_real_toc_entry(raw_header: str, title: str, raw_lines: List[str]) -> bool:
    t = (_nfkc(raw_header) + " " + _nfkc(title)).lower()
    if "wahlperiode" in t or "inhalt" in t:
        return False
    for ln in raw_lines or []:
        tl = _nfkc(ln).lower()
        if "haus des landtags" in tl or "schluss:" in tl:
            return False
    m = re.match(r"^\s*(\d{1,2})\.\s+", _nfkc(raw_header))
    if not m:
        return False
    num = int(m.group(1))
    return 1 <= num <= 50

def normalize_toc_items(toc: Dict[str, Any]) -> Dict[str, Any]:
    items = toc.get("items") or []
    norm_items: List[Dict[str, Any]] = []
    last_valid_num = 0

    for it in items:
        raw_header = it.get("raw_header") or ""
        title_in = it.get("title") or ""
        raw_lines = it.get("raw_lines") or []

        title = _cleanup_toc_title_noise(remove_fill_dots(_nfkc(title_in)))

        if not looks_like_real_toc_entry(raw_header, title, raw_lines):
            continue

        m = re.match(r"^\s*(\d{1,2})\.", _nfkc(raw_header))
        if not m:
            continue
        num = int(m.group(1))
        if num < last_valid_num:
            continue
        last_valid_num = num

        subentries = it.get("subentries") or []
        extra = it.get("extra") or ""
        extra_all = " ".join([extra] + [se.get("text", "") for se in subentries])
        extra_all = remove_fill_dots(_nfkc(extra_all))
        new_subentries: List[Dict[str, Any]] = []
        for label in ["Beschluss", "Beschlussempfehlung", "Bericht"]:
            for m2 in re.finditer(rf"\b{label}\b.*?(\d{{3,5}})?", extra_all):
                pages = []
                if m2.group(1):
                    try:
                        pages = [int(m2.group(1))]
                    except ValueError:
                        pages = []
                new_subentries.append({"type": label, "text": m2.group(0).strip(), "pages": pages})

        drs = it.get("drucksachen") or []
        drs2 = extract_drucksachen_from_raw_lines(raw_lines)
        drucksachen = list(dict.fromkeys(drs + drs2))

        speakers = []
        for sp in it.get("speakers") or []:
            role = sp.get("role")
            name_raw = sp.get("name") or ""
            name_clean, party = normalize_party_in_name(name_raw)
            pages_field = sp.get("pages") or ""
            pages = []
            if isinstance(pages_field, str):
                for p in re.split(r"[,\s]+", pages_field):
                    if p.isdigit():
                        pages.append(int(p))
            elif isinstance(pages_field, list):
                for p in pages_field:
                    if isinstance(p, int):
                        pages.append(p)
            speakers.append({
                "role": role,
                "name": name_clean,
                "party": party or _normalize_party(sp.get("party")),
                "pages": pages
            })

        norm_items.append({
            **it,
            "number": num,
            "title": title,
            "drucksachen": drucksachen,
            "subentries": new_subentries or subentries,
            "speakers": speakers,
        })

    return {"items": norm_items}

def attach_agenda_numbers(speeches: List[Dict[str, Any]]) -> None:
    current = None
    for sp in speeches:
        text = sp.get("text") or ""
        m = RE_ICH_RUFE_TOP.search(text) or RE_ICH_RUFE_PUNKT.search(text)
        if m:
            try:
                current = int(m.group(1))
            except ValueError:
                pass
        if current is not None:
            sp["agenda_item_number"] = current

# ------------------------- Speeches (Body) -------------------------

HEADER_RX = re.compile(
    rf"^\s*(?P<role>{'|'.join(ROLE_TOKENS)})\s+(?P<name>[^:\n]{{1,160}}?)(?:\s+(?P<party>{PARTY_TOKENS}))?\s*:\s*(?:\S.*)?$",
    re.IGNORECASE
)

INLINE_HEADER_NOISE = [
    re.compile(r"Landtag\s*von\s*Baden[- ]Württemberg", re.IGNORECASE),
    re.compile(r"\b\d{1,2}\.\s*Wahlperiode\b", re.IGNORECASE),
    re.compile(r"\b\d{1,3}\.\s*Sitzung\b", re.IGNORECASE),
    re.compile(r"\bPlenarprotokoll\b", re.IGNORECASE)
]

EVENT_KEYWORDS = ["Beifall", "Zuruf", "Heiterkeit", "Lachen", "Unruhe", "Zwischenruf", "Glocke"]
DASH_EVENT_RE = re.compile(r"^[–-]\s*(Beifall|Zuruf|Heiterkeit|Lachen|Unruhe|Zwischenruf|Glocke)\b.*", re.IGNORECASE)

def _strip_inline_headers_from_text(text: str) -> str:
    lines = text.splitlines()
    out = []
    for ln in lines:
        t = _nfkc(ln).strip()
        if not t:
            continue
        if any(rx.search(t) for rx in INLINE_HEADER_NOISE):
            for rx in INLINE_HEADER_NOISE:
                t = rx.sub("", t)
            t = re.sub(r"\s{2,}", " ", t).strip(" –—- ")
            if not t:
                continue
        out.append(t)
    return "\n".join(out).strip()

def segment_speeches_from_pages(pages: List[List[str]]) -> List[Dict[str, Any]]:
    flat: List[Tuple[int, str]] = []
    for p_idx, lines in enumerate(pages, start=1):
        for l in lines:
            if l.strip():
                flat.append((p_idx, l))
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
        lstripped = line.lstrip()
        # Neue Rede nur, wenn Zeile nicht mit '(' oder '–'/'-' beginnt (verhindert Klammer-/Dash-Zwischenrufe)
        if not (lstripped.startswith("(") or lstripped.startswith("–") or lstripped.startswith("-")):
            m = HEADER_RX.match(line)
        else:
            m = None
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
                buf.append(line)
    flush()
    for i, sp in enumerate(speeches):
        sp["index"] = i
    return speeches

def normalize_speech_text(text: str) -> str:
    t = remove_fill_dots(_nfkc(text))
    t = _strip_inline_headers_from_text(t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"(\n)[ \t]+", r"\1", t)
    return t.strip()

def cleanup_speech_events_in_text(sp: Dict[str, Any]) -> None:
    text = sp.get("text") or ""
    lines = text.splitlines()
    body_lines: List[str] = []
    events: List[Dict[str, Any]] = []

    def _push_event(label: str, raw_text: str):
        canonical = {
            "beifall": "Beifall",
            "zuruf": "Zuruf",
            "heiterkeit": "Heiterkeit",
            "lachen": "Lachen",
            "unruhe": "Unruhe",
            "zwischenruf": "Zwischenruf",
            "glocke": "Glocke"
        }.get(label.lower(), "Event")
        events.append({"type": canonical, "text": raw_text})

    for ln in lines:
        ln_stripped = ln.strip()
        # Klammer-Events: (Beifall …)
        if ln_stripped.startswith("(") and ln_stripped.endswith(")"):
            if any(kw.lower() in ln_stripped.lower() for kw in EVENT_KEYWORDS):
                # Label heuristisch bestimmen
                label = "Event"
                for kw in EVENT_KEYWORDS:
                    if kw.lower() in ln_stripped.lower():
                        label = kw
                        break
                _push_event(label, ln_stripped)
                continue
        # Dash-Events: – Zuruf … / – Beifall …
        m = DASH_EVENT_RE.match(ln_stripped)
        if m:
            _push_event(m.group(1), ln_stripped)
            continue
        body_lines.append(ln)
    sp["text"] = "\n".join(body_lines).strip()
    if events:
        sp["events"] = events

def _normalize_speeches(speeches: List[Dict[str, Any]]) -> None:
    for sp in speeches:
        sp["text"] = normalize_speech_text(sp.get("text") or "")
        cleanup_speech_events_in_text(sp)
    attach_agenda_numbers(speeches)

def prune_empty_speeches(speeches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    pruned = [sp for sp in speeches if (sp.get("text") or "").strip()]
    for i, sp in enumerate(pruned):
        sp["index"] = i
    return pruned

# ------------------------- Metadata helpers -------------------------

BEGINN_RE = re.compile(r"Beginn\s*:?\s*(\d{1,2})[:.]?(\d{2})\s*Uhr", re.IGNORECASE)
SCHLUSS_RE = re.compile(r"Schluss\s*:?\s*(\d{1,2})[:.]?(\d{2})\s*Uhr", re.IGNORECASE)

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
    if not date:
        m4 = re.search(r"\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b", all_text)
        if m4:
            d, m, y = int(m4.group(1)), int(m4.group(2)), int(m4.group(3))
            if 1 <= m <= 12 and 1 <= d <= 31:
                date = f"{y:04d}-{m:02d}-{d:02d}"
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

# ------------------------- Party enrichment & TOC backfill -------------------------

def _normalize_person_name(n: Optional[str]) -> Optional[str]:
    if not n:
        return n
    n2 = unicodedata.normalize("NFKC", n)
    n2 = re.sub(r"\s+", " ", n2).strip()
    return n2

def enrich_toc_parties_from_speeches(toc: Dict[str, Any], speeches: List[Dict[str, Any]]) -> None:
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

def backfill_toc_speakers_from_speeches(toc: Dict[str, Any], speeches: List[Dict[str, Any]]) -> None:
    """
    Falls ein TOC-Item keine Redner aus dem Inhaltsverzeichnis enthält,
    fülle es aus den tatsächlichen Reden (Agenda-Nummer).
    Reihenfolge: erste Vorkommen in der Debatte, einzigartig pro Sprecher.
    """
    # Baue Index: agenda_num -> Liste eindeutiger (role, name, party) in Reihenfolge
    by_agenda: Dict[int, List[Tuple[Optional[str], str, Optional[str]]]] = {}
    seen_per_agenda: Dict[int, set] = {}
    for sp in speeches:
        num = sp.get("agenda_item_number")
        if not isinstance(num, int):
            continue
        name = _normalize_person_name(sp.get("speaker")) or ""
        role = sp.get("role")
        party = _normalize_party(sp.get("party"))
        key = (role or "", name or "", party or "")
        if num not in by_agenda:
            by_agenda[num] = []
            seen_per_agenda[num] = set()
        if key not in seen_per_agenda[num]:
            seen_per_agenda[num].add(key)
            by_agenda[num].append((role, name, party))

    # Backfill nur wenn speakers leer sind
    for item in toc.get("items", []):
        if (item.get("speakers") or []):
            continue
        num = item.get("number")
        if not isinstance(num, int):
            continue
        seq = by_agenda.get(num) or []
        if not seq:
            continue
        item["speakers"] = [{"role": r, "name": n, "party": p, "pages": None} for (r, n, p) in seq]

# ------------------------- TOC Interleave Fallback -------------------------

def extract_toc_interleaved_flat_lines(pdf_path: Path, first_page: int = 1, last_page: int = 3) -> List[Dict[str, Any]]:
    """Extrahiert die ersten Seiten spaltenübergreifend in (y,x)-Lesereihenfolge für robustes TOC-Parsen."""
    flat: List[Dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        last = min(len(pdf.pages), max(1, last_page))
        first = max(1, min(first_page, last))
        for pidx in range(first, last + 1):
            page = pdf.pages[pidx - 1]
            pw = float(page.width or 0.0)
            split_x = pw * 0.5
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
            if not words:
                continue
            left, right, full = _assign_columns(words, split_x=split_x, margin=COLUMN_MARGIN_PTS)
            # Kombiniere alle Worte; sortiere Zeilen nach (y,x)
            lines_xy = _words_to_lines_with_xy(full + left + right)
            for li, (_y, _x, text) in enumerate(lines_xy):
                if text.strip():
                    flat.append({"page": pidx, "line_index": li, "text": text})
    return flat

def pick_better_toc(primary: Dict[str, Any], fallback: Dict[str, Any]) -> Dict[str, Any]:
    def score(t: Dict[str, Any]) -> Tuple[int, int]:
        items = t.get("items", [])
        total_speakers = sum(len(it.get("speakers") or []) for it in items)
        with_title = sum(1 for it in items if (it.get("title") or "").strip())
        return (total_speakers, with_title)
    return fallback if score(fallback) > score(primary) else primary

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

    pages_raw, metas = extract_lines_fixed_mid(pdf_path)

    pages_filtered, hf_debug = filter_repeating_headers_footers(
        pages_raw, top_n=HF_TOP_N, bottom_n=HF_BOTTOM_N, min_share=HF_MIN_SHARE, skip_first_n_pages=3
    )

    pages_prepped = _secondary_pipeline_after_layout(pages_filtered)

    all_text = "\n".join("\n".join(p) for p in pages_prepped)
    meta = parse_session_info(all_text)
    meta["source_pdf_url"] = url
    meta["extracted_at"] = dt.datetime.utcnow().isoformat() + "Z"

    flat = pages_to_flat_lines(pages_prepped)
    toc_lines, _body_lines, meta_split = split_toc_and_body(flat, stop_at_first_body_header=True)

    # Erstes TOC-Parsen auf Basis der Standard-Serialisierung
    toc = {"items": []}
    if toc_lines:
        toc = parse_toc(toc_lines)
        toc = normalize_toc_items(toc)

    # Fallback: Interleaving nur für TOC-Seiten (z. B. 1..3) wenn Items ohne Redner existieren
    needs_fallback = any((len(it.get("speakers") or []) == 0) for it in toc.get("items", []))
    if needs_fallback:
        try:
            # Ermittele TOC-Seitenbereich aus toc_lines, fallback auf 1..3
            if toc_lines:
                pmin = min(obj.get("page", 9999) for obj in toc_lines)
                pmax = max(obj.get("page", 0) for obj in toc_lines)
                pmin = max(1, pmin)
                pmax = max(pmin, min(3, pmax))
            else:
                pmin, pmax = 1, 3
            inter_flat = extract_toc_interleaved_flat_lines(pdf_path, first_page=pmin, last_page=pmax)
            if inter_flat:
                toc2 = parse_toc(inter_flat)
                toc2 = normalize_toc_items(toc2)
                toc = pick_better_toc(toc, toc2)
        except Exception:
            pass

    speeches = segment_speeches_from_pages(pages_prepped)
    _normalize_speeches(speeches)
    speeches = prune_empty_speeches(speeches)

    # Parteien aus Reden übernehmen
    enrich_toc_parties_from_speeches(toc, speeches)
    # Fehlende Redner im TOC aus Reden befüllen
    backfill_toc_speakers_from_speeches(toc, speeches)

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
        "stats": {"pages": len(pages_prepped), "speeches": len(speeches)},
        "layout": {
            "applied": True,
            "reason": "fixed-mid-split + header/footer-filter + post-cleanup (+ TOC interleave fallback)"
        },
        "toc": toc,
        "speeches": speeches
    }
    payload["_layout_debug_internal"] = {
        "layout_metadata": [m.__dict__ for m in metas],
        "normalized_pages": pages_raw,
        "filtered_pages": pages_filtered,
        "post_cleaned_pages": pages_prepped,
        "header_footer_filter": hf_debug,
        "toc_fallback_used": needs_fallback
    }

    try:
        expected_toc = max((it.get("number", 0) for it in toc.get("items", [])), default=0)
        payload["_qa"] = {
            "toc_items": len(toc.get("items", [])),
            "toc_max_number": expected_toc,
            "speeches_with_agenda": sum(1 for s in speeches if "agenda_item_number" in s),
            "toc_total_speakers": sum(len(it.get("speakers") or []) for it in toc.get("items", []))
        }
    except Exception:
        pass

    return payload

# ------------------------- IO / CLI -------------------------

def write_outputs(payload: Dict[str, Any], out_dir: Path) -> Tuple[Path, Optional[Path]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    base = build_session_filename(payload)
    session_path = out_dir / base
    layout_file = base.replace(".json", ".layout.json")
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

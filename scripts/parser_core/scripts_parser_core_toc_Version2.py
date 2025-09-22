import re
from typing import List, Dict, Optional

TOC_HEADER_PATTERN = re.compile(r"\bINHALT\b", re.IGNORECASE)

# Muster für nummerierte Punkte: "1. Aktuelle Debatte – ..."
NUM_ITEM_PATTERN = re.compile(r"^(?P<num>\d{1,2})\.\s+(?P<title>.+?)\.*\s*(?P<page>\d{3,5})?$")
# Unnummerierter Eintrag (z.B. Eröffnung – Mitteilungen der Präsidentin ...... 7639)
UNNUM_ITEM_PATTERN = re.compile(r"^(?P<title>[^0-9].+?)\.*\s+(?P<page>\d{3,5})$")

DOT_LEADER_CLEAN = re.compile(r"\.{2,}")

def detect_toc_region(first_page_lines: List[str]) -> List[str]:
    """
    Grob: Suche 'INHALT' und sammle danach Zeilen bis zu erster ganz leeren oder
    sichtbar Layout-Wechsel (Heuristik: > 1 Leerzeile).
    """
    lines = first_page_lines
    start_idx = None
    for i,l in enumerate(lines):
        # Normalisieren gesperrte Schreibweise "I N H A L T"
        norm = re.sub(r"\s+", "", l.upper())
        if norm == "INHALT":
            start_idx = i
            break
    if start_idx is None:
        return []
    # Nimm die nächsten ~70 Zeilen oder bis harter Cut
    region = []
    empty_run = 0
    for l in lines[start_idx+1:]:
        if not l.strip():
            empty_run += 1
            if empty_run >= 2:
                break
            else:
                continue
        empty_run = 0
        region.append(l.rstrip())
        # Abbruchheuristik: Wenn wir auf eine neue Seitenstruktur stoßen könnten
        if len(region) > 120:
            break
    return region

def merge_wrapped_lines(toc_lines: List[str]) -> List[str]:
    """
    TOC-Einträge können umbrechen, bevor die Seitenzahl kommt.
    Heuristik:
    - Wenn Zeile ohne Seitenzahl endet und nächste Zeile klein beginnt (oder kursiv/Bindestrich),
      dann zusammenführen.
    - Seitenzahl-Check: Ziffernblock am Ende.
    """
    merged = []
    buffer = ""
    def commit():
        nonlocal buffer
        if buffer:
            merged.append(buffer.strip())
            buffer = ""

    for l in toc_lines:
        if not buffer:
            buffer = l
            # Falls Zeile bereits '.... 7640' enthält → direkt commit
            if re.search(r"\d{3,5}$", l.strip()):
                commit()
            continue
        else:
            # Prüfen ob vorherige Zeile keine PageNum hatte
            if not re.search(r"\d{3,5}$", buffer) and not NUM_ITEM_PATTERN.search(buffer) and not UNNUM_ITEM_PATTERN.search(buffer):
                # Fortsetzung
                buffer += " " + l.strip()
                if re.search(r"\d{3,5}$", buffer):
                    commit()
            else:
                commit()
                buffer = l
                if re.search(r"\d{3,5}$", buffer):
                    commit()
    commit()
    return merged

def parse_toc(first_page_lines: List[str]) -> List[Dict]:
    region = detect_toc_region(first_page_lines)
    if not region:
        return []
    region = [DOT_LEADER_CLEAN.sub(" ", r).strip() for r in region if r.strip()]
    region = merge_wrapped_lines(region)

    items = []
    for raw in region:
        m = NUM_ITEM_PATTERN.match(raw)
        if m:
            items.append({
                "raw": raw,
                "index": int(m.group("num")),
                "title": clean_title(m.group("title")),
                "page_in_pdf": int(m.group("page")) if m.group("page") else None,
                "numbered": True
            })
            continue
        m2 = UNNUM_ITEM_PATTERN.match(raw)
        if m2:
            items.append({
                "raw": raw,
                "index": None,
                "title": clean_title(m2.group("title")),
                "page_in_pdf": int(m2.group("page")),
                "numbered": False
            })
            continue
        # Fall: Zeile ohne erkannte Struktur – eventuell Fortsetzung → skip oder debug sammeln
    return items

DASH_VARIANTS = re.compile(r"\s+[–\-]\s+")

def clean_title(t: str) -> str:
    t = t.strip()
    # Mehrfache Leerzeichen
    t = re.sub(r"\s+", " ", t)
    return t
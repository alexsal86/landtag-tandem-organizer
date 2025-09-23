import re
import unicodedata
from typing import List, Dict, Any, Tuple, Optional

# Lokale Imports (öffentliche Funktionen)
from .toc_parser import parse_toc
from .segment import segment_speeches

"""
Pipeline-Helfer zum Einbinden des TOC-Parsers in den Gesamt-Parsing-Flow.

Funktionen:
- split_toc_and_body(flat_lines, ...) -> (toc_lines, body_lines, meta)
- parse_protocol(flat_lines, ...) -> { "toc": {...}, "speeches": [...], "meta": {...} }

Heuristik:
1) TOC-Bereich beginnt, sobald eine Überschrift "INHALT" erkannt wird (auch: "I N H A L T").
2) TOC endet, wenn
   - eine Kopfzeile mit "Protokoll" erreicht wird ODER
   - der erste echte Header einer Rede auftaucht (z. B. "Präsidentin ...:" am Absatzanfang).
3) Reden werden anschließend über segment_speeches() extrahiert.

Die Pipeline ist tolerant:
- Zusätzliche Kopf-/Fußzeilen werden ignoriert.
- Wenn kein "INHALT" gefunden wird, behandeln wir den TOC als leer.
"""

# Rolle+Name+":" (lockere Variante für Body-Start-Erkennung)
ROLE_TOKENS = [
    r"Abg\.", r"Abgeordneter", r"Abgeordnete",
    r"Präsidentin", r"Präsident",
    r"Stellv\.\s*Präsidentin?", r"Stellv\.\s*Präsident",
    r"Ministerpräsidentin?", r"Ministerpräsident",
    r"Ministerin?", r"Minister",
    r"Staatssekretärin?", r"Staatssekretär"
]
ROLE_PATTERN = "(?:" + "|".join(ROLE_TOKENS) + ")"
HEADER_LINE_RE = re.compile(
    rf"^\s*(?P<role>{ROLE_PATTERN})\s+[^\n:]+:\s*"
)

# "INHALT" auch mit gesperrten Buchstaben (I N H A L T)
INHALT_HEADING_RE = re.compile(r"^\s*I\s*N\s*H\s*A\s*L\s*T\s*$", re.IGNORECASE)
PROTOKOLL_HEADING_RE = re.compile(r"^\s*Protokoll(\b|$)", re.IGNORECASE)

def _nfkc(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "")

def looks_like_inhalt_heading(line: str) -> bool:
    t = _nfkc(line).strip()
    if INHALT_HEADING_RE.match(t):
        return True
    # häufig auch einfach "INHALT"
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
    - stop_at_first_body_header: Wenn True, endet TOC spätestens bei erster „Rolle …:“ Zeile.

    Rückgabe:
    (toc_lines, body_lines, meta)
    meta = {
      "inhalt_found": bool,
      "body_start_index": int | None,
      "body_start_reason": "protokoll" | "role_header" | None
    }
    """
    toc_lines: List[Dict[str, Any]] = []
    body_lines: List[Dict[str, Any]] = []
    in_toc = False
    body_start_idx: Optional[int] = None
    body_start_reason: Optional[str] = None

    for idx, obj in enumerate(flat_lines):
        text = _nfkc(obj.get("text") or "")
        # akt. Zeile leer -> einfach mitnehmen unter aktuellem Modus
        if not text.strip():
            if in_toc:
                toc_lines.append(obj)
            else:
                body_lines.append(obj)
            continue

        if not in_toc:
            # TOC-Beginn?
            if looks_like_inhalt_heading(text):
                in_toc = True
                toc_lines.append(obj)
                continue
            # Noch kein TOC: alles bis dahin als "vor TOC" ignorieren (Kopfzeilen)
            # Ausnahme: Body-Start sicher erkannt -> kein TOC vorhanden
            if is_body_start_line(text):
                body_start_idx = idx
                body_start_reason = "protokoll" if PROTOKOLL_HEADING_RE.match(text) else "role_header"
                # Rest als Body
                body_lines.extend(flat_lines[idx:])
                break
            # ansonsten Kopfbereich ignorieren
            continue

        # Wir sind im TOC-Bereich
        if PROTOKOLL_HEADING_RE.match(text):
            body_start_idx = idx
            body_start_reason = "protokoll"
            body_lines.extend(flat_lines[idx:])
            break

        if stop_at_first_body_header and HEADER_LINE_RE.match(text):
            # Sicherheit: falls in seltenen Fällen schon früher eine Rollen-Zeile mit ":" auftaucht
            body_start_idx = idx
            body_start_reason = "role_header"
            body_lines.extend(flat_lines[idx:])
            break

        # sonst gehört die Zeile weiterhin zum TOC
        toc_lines.append(obj)

    # Falls Ende erreicht und Body noch leer: Rest ist Body (nach TOC)
    if in_toc and not body_lines and body_start_idx is None:
        # wir sind bis zum Ende im TOC geblieben, kein Body-Start erkannt -> kein Body
        pass
    elif not in_toc and not body_lines:
        # Es gab gar keinen TOC. Der gesamte Input ist Body.
        body_lines = list(flat_lines)

    meta = {
        "inhalt_found": in_toc,
        "body_start_index": body_start_idx,
        "body_start_reason": body_start_reason
    }
    return toc_lines, body_lines, meta

def parse_protocol(
    flat_lines: List[Dict[str, Any]],
    *,
    # segment_speeches Optionen
    capture_offsets: bool = False,
    debug: bool = False,
    require_bold_for_header: bool = False,
    allow_abg_without_party: bool = True,
    fallback_inline_header: bool = True,
    compact_interjections: bool = True,
    include_interjection_category: bool = False,
    externalize_interjection_offsets: bool = False,
    # TOC Optionen
    stop_toc_at_first_body_header: bool = True
) -> Dict[str, Any]:
    """
    Führt TOC-Parsing und Rede-Segmentierung aus und gibt ein gemeinsames Ergebnis zurück.
    """
    toc_lines, body_lines, meta = split_toc_and_body(
        flat_lines,
        stop_at_first_body_header=stop_toc_at_first_body_header
    )

    toc = {"items": []}
    if toc_lines:
        toc = parse_toc(toc_lines)

    speeches_or_bundle = segment_speeches(
        body_lines,
        capture_offsets=capture_offsets,
        debug=debug,
        require_bold_for_header=require_bold_for_header,
        allow_abg_without_party=allow_abg_without_party,
        fallback_inline_header=fallback_inline_header,
        compact_interjections=compact_interjections,
        include_interjection_category=include_interjection_category,
        externalize_interjection_offsets=externalize_interjection_offsets
    )

    if externalize_interjection_offsets:
        # segment_speeches liefert hier ein Dict { "speeches": [...], "interjection_offsets": [...] }
        assert isinstance(speeches_or_bundle, dict)
        return {
            "toc": toc,
            "speeches": speeches_or_bundle.get("speeches", []),
            "interjection_offsets": speeches_or_bundle.get("interjection_offsets", []),
            "meta": meta
        }
    else:
        assert isinstance(speeches_or_bundle, list)
        return {
            "toc": toc,
            "speeches": speeches_or_bundle,
            "meta": meta
        }